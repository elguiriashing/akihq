"""Create a verified candidate Git tree/commit only. Never update refs or deploy."""
import hashlib,json,os,pathlib,subprocess,urllib.request
BASE='d653c121b461f683a1d639e8c7057118b25c0a37'
BASE_TREE='48cdc6025987f313d71d88cd2b87007ed7b3b95d'
TREE='c4c9a865305c2334abf81de75158de7bb862ac76'
REPO='elguiriashing/akihq'
assert os.environ['GITHUB_REPOSITORY']==REPO
assert subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()==BASE
assert subprocess.check_output(['git','write-tree']).decode().strip()==TREE
assert not subprocess.check_output(['git','diff','--name-only']), 'Unstaged source changes'
paths=subprocess.check_output(['git','diff','--cached','--name-only','-z']).decode().split('\0')
entries=[];checksums={}
for name in filter(None,paths):
 p=pathlib.Path(name)
 assert not p.is_absolute() and '..' not in p.parts and not p.is_symlink()
 assert not name.startswith('tools/course-candidate/')
 if not p.exists():entries.append({'path':name,'mode':'100644','type':'blob','sha':None});checksums[name]=None
 else:
  b=p.read_bytes();entries.append({'path':name,'mode':'100644','type':'blob','content':b.decode('utf-8')});checksums[name]=hashlib.sha256(b).hexdigest()
def post(endpoint,payload):
 request=urllib.request.Request('https://api.github.com/repos/'+REPO+'/git/'+endpoint,data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},method='POST')
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)
tree=post('trees',{'base_tree':BASE_TREE,'tree':entries})
assert tree['sha']==TREE,'Remote tree does not match the locally reviewed candidate'
commit=post('commits',{'message':'feat(pos): transactional course holds, firing and fullscreen service controls','tree':TREE,'parents':[BASE]})
assert commit['tree']['sha']==TREE and [p['sha'] for p in commit['parents']]==[BASE]
out=pathlib.Path(os.environ['RUNNER_TEMP'])/'course-evidence';out.mkdir(exist_ok=True)
(out/'candidate.json').write_text(json.dumps({'base':BASE,'tree':TREE,'commit':commit['sha'],'url':commit['html_url'],'files':checksums,'ref_updated':False,'production_changed':False},indent=2))
print(json.dumps({'candidate_commit':commit['sha'],'tree':TREE,'ref_updated':False}))
