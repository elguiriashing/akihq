"""Multi-connection tests on an isolated PostgreSQL service, with synthetic data."""
import concurrent.futures, json, os, subprocess, threading, uuid
OWNER='00000000-0000-0000-0000-000000000001'
ITEM='20000000-0000-0000-0000-000000000001'
assert os.environ.get('PGDATABASE')=='pos_kds_test','Refusing any database except the dedicated pos_kds_test fixture'
def sql(text):
 p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-c',text],text=True,capture_output=True,timeout=20)
 if p.returncode:raise RuntimeError(p.stderr.strip())
 return p.stdout.strip()
def quote(value):return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def rpc(name,payload,key=None,hold=False):
 query=f"SELECT public.{name}('tenant-a','{key or uuid.uuid4()}',{quote(payload)});"
 result=sql(f"BEGIN; SET LOCAL test.user_id='{OWNER}'; SET LOCAL ROLE authenticated; {query}"+('SELECT pg_sleep(0.3);' if hold else '')+' COMMIT;')
 return json.loads(next(line for line in result.splitlines() if line.startswith('{')))
def get_board():
 return json.loads(sql(f"BEGIN; SET LOCAL test.user_id='{OWNER}'; SET LOCAL ROLE authenticated; SELECT public.crm_kds_overview('tenant-a'); COMMIT;"))
def order(label):
 oid=rpc('crm_hospitality_command',{'action':'open','label':label})['order_id']
 rpc('crm_hospitality_command',{'action':'add','order_id':oid,'version':0,'item_id':ITEM})
 rpc('crm_hospitality_command',{'action':'send','order_id':oid,'version':1})
 return oid
def card(oid):return next(c for c in get_board()['cards'] if c['order_id']==oid)
def advance(c,state):return {'action':'kds_advance','order_id':c['order_id'],'station':c['station'],'version':c['version'],'state':state,'line_id':'*'}
def race(jobs):
 barrier=threading.Barrier(len(jobs))
 def run(job):
  barrier.wait()
  try:return {'ok':job()}
  except RuntimeError as e:return {'error':str(e)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=len(jobs)) as pool:return list(pool.map(run,jobs))
rpc('crm_kds_command',{'action':'kds_enable','confirmed':True})
oid=order('Two tablets');c=card(oid);payload=advance(c,'preparing')
results=race([lambda:rpc('crm_kds_command',payload,hold=True),lambda:rpc('crm_kds_command',payload,hold=True)])
assert sum('ok' in r for r in results)==1,results
assert sum('Kitchen card changed' in r.get('error','') for r in results)==1,results
assert card(oid)['version']==c['version']+1
print('PASS: simultaneous different commands reject the stale device')
c=card(oid);payload=advance(c,'ready');key=str(uuid.uuid4())
results=race([lambda:rpc('crm_kds_command',payload,key,True),lambda:rpc('crm_kds_command',payload,key,True)])
assert all('ok' in r for r in results) and results[0]==results[1],results
assert card(oid)['version']==c['version']+1
assert sql(f"SELECT count(*) FROM akihq_hospitality.events WHERE command_id='{key}'")== '1'
print('PASS: simultaneous identical retries create one event and one transition')
oid=order('Waiter and kitchen');c=card(oid)
revision={'action':'note','order_id':oid,'version':2,'note':'Allergy instruction changed','guests':2}
results=race([lambda:rpc('crm_kds_command',advance(c,'preparing'),hold=True),lambda:rpc('crm_hospitality_command',revision,hold=True)])
assert 'ok' in results[1],results
assert 'ok' in results[0] or 'changed' in results[0].get('error',''),results
c=card(oid);assert c['review_required'] and c['source']['note']=='Allergy instruction changed'
assert set(c['progress'].values())<= {'queued','preparing'}
print('PASS: waiter revisions and kitchen progress share the same transaction lock')
