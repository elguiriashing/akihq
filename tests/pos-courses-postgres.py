"""Independent-connection course races against an isolated PostgreSQL service."""
import concurrent.futures, json, os, subprocess, threading, uuid
OWNER='00000000-0000-0000-0000-000000000001'
ITEM='20000000-0000-0000-0000-000000000001'
assert os.environ.get('PGDATABASE')=='pos_courses_test','Refusing any database except the dedicated pos_courses_test fixture'
def sql(text):
 p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-c',text],text=True,capture_output=True,timeout=20)
 if p.returncode:raise RuntimeError(p.stderr.strip())
 return p.stdout.strip()
def quote(value):return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def rpc(name,payload,key=None,hold=False):
 query=f"SELECT public.{name}('tenant-a','{key or uuid.uuid4()}',{quote(payload)});"
 result=sql(f"BEGIN; SET LOCAL test.user_id='{OWNER}'; SET LOCAL ROLE authenticated; {query}"+('SELECT pg_sleep(0.3);' if hold else '')+' COMMIT;')
 return json.loads(next(line for line in result.splitlines() if line.startswith('{')))
def order(oid):return json.loads(sql(f"SELECT to_jsonb(o) FROM akihq_hospitality.orders o WHERE id='{oid}'"))
def fresh(label):
 oid=rpc('crm_hospitality_command',{'action':'open','label':label})['order_id']
 rpc('crm_hospitality_command',{'action':'add','order_id':oid,'version':0,'item_id':ITEM,'course':2})
 return order(oid)
def fire(o):return {'action':'course_fire','order_id':o['id'],'version':o['version'],'course':2,'confirmed':True}
def race(jobs):
 barrier=threading.Barrier(len(jobs))
 def run(job):
  barrier.wait()
  try:return {'ok':job()}
  except RuntimeError as e:return {'error':str(e)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=len(jobs)) as pool:return list(pool.map(run,jobs))
def prep_count(oid):return int(sql(f"SELECT count(*) FROM akihq_hospitality.tickets WHERE order_id='{oid}' AND kind='preparation'"))
rpc('crm_kds_command',{'action':'kds_enable','confirmed':True})
o=fresh('Two course tablets');payload=fire(o)
results=race([lambda:rpc('crm_course_command',payload,hold=True),lambda:rpc('crm_course_command',payload,hold=True)])
assert sum('ok' in r for r in results)==1,results
assert sum('Order changed' in r.get('error','') for r in results)==1,results
assert order(o['id'])['version']==o['version']+1 and prep_count(o['id'])==1
print('PASS: two independent course fires produce one revision and reject the stale device')
o=fresh('Identical retries');payload=fire(o);key=str(uuid.uuid4())
results=race([lambda:rpc('crm_course_command',payload,key,True),lambda:rpc('crm_course_command',payload,key,True)])
assert all('ok' in r for r in results) and results[0]==results[1],results
assert order(o['id'])['version']==o['version']+1 and prep_count(o['id'])==1
assert sql(f"SELECT count(*) FROM akihq_hospitality.events WHERE command_id='{key}'")=='1'
print('PASS: simultaneous identical retries return one persisted result and one print job')
o=fresh('Waiter correction');payload=fire(o);line=o['lines'][0]
edit={'action':'line','order_id':o['id'],'version':o['version'],'line_id':line['id'],'quantity':line['quantity'],'station':'kitchen','seat':'','note':'New instruction'}
results=race([lambda:rpc('crm_course_command',payload,hold=True),lambda:rpc('crm_hospitality_command',edit,hold=True)])
assert sum('ok' in r for r in results)==1,results
assert any('changed' in r.get('error','').lower() for r in results),results
current=order(o['id'])
if 'ok' in results[0]:assert not current['lines'][0]['course_held'] and current['sent'][0]['note']==''
else:assert current['lines'][0]['course_held'] and current['sent']==[] and current['lines'][0]['note']=='New instruction'
print('PASS: waiter edits and course fires share a lock and require review of new instructions')
o=fresh('Final payment race');payload=fire(o)
pay={'action':'payment','order_id':o['id'],'version':o['version'],'amount_cents':o['lines'][0]['unit_price_cents'],'method':'cash'}
results=race([lambda:rpc('crm_course_command',payload,hold=True),lambda:rpc('crm_hospitality_command',pay,hold=True)])
assert 'ok' in results[0] and 'error' in results[1],results
assert order(o['id'])['status']=='open' and order(o['id'])['payments']==[]
print('PASS: a final-payment race cannot close or collect a held course')
o=fresh('Normal Send race');payload=fire(o)
send={'action':'send','order_id':o['id'],'version':o['version']}
results=race([lambda:rpc('crm_course_command',payload,hold=True),lambda:rpc('crm_hospitality_command',send,hold=True)])
assert 'ok' in results[0] and 'error' in results[1],results
assert prep_count(o['id'])==1 and len(order(o['id'])['sent'])==1
print('PASS: normal Send cannot bypass held dishes or duplicate a simultaneous course fire')
