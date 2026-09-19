(function () {
  "use strict";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const number = n => Number(n || 0).toLocaleString("en-GB");
  const fields = ["name","address","city","email","website","phone","type","source","externalId"];
  const label = { name:"Business name *",address:"Street address *",city:"City / town",email:"Email",website:"Website",phone:"Phone",type:"Business type",source:"Source",externalId:"Original reference ID" };
  const btn = (action,text,extra="") => `<button type="button" class="action-btn${action==="commit"?" primary":""}" data-company-action="${action}" ${extra}>${text}</button>`;
  const csv = v => '"'+String(v ?? "").replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  window.createCompanyManager = function(ctx) {
    let page={rows:[],total:0}, offset=0, search="", view="all", loading=false, loaded=false, pageError="", loadedAt=0;
    let modal=null, worker=null, requestId=0, pending=new Map(), paused=false, active=false, generation=0;
    const allowed = () => ctx.allowed();
    async function rpc(name,args={}) {
      if (!allowed()) throw new Error("Open the AkiPasa workspace and sign in again.");
      const {data,error}=await ctx.client().rpc(name,args);
      if (error) { const failure=new Error(error.message || "Database request failed."); failure.code=error.code||""; throw failure; }
      return data;
    }
    function table() {
      return `<div class="panel-header"><div><h2>Companies</h2><p>${number(page.total)} matching companies · saved in AkiPasa</p></div>${ctx.admin()?btn("publish","Publish valid companies to map")+btn("review-publish","AI screen & publish unpublished"):""}</div>
      <div class="company-toolbar"><form data-company-search><input aria-label="Search companies" name="search" value="${esc(search)}" placeholder="Search name, town or address"><button class="action-btn" type="submit">Search</button></form>
      <select aria-label="Company filter" data-company-filter>${[["all","All companies"],["imported","Imported companies"],["unpublished","Not on the map"],["review","Publishing needs review"]].map(([v,t])=>`<option value="${v}" ${view===v?"selected":""}>${t}</option>`).join("")}</select>${ctx.admin()?btn("history","Backups & import history"):""}${btn("refresh","Refresh")}</div>
      ${pageError?`<p class="company-error">${esc(pageError)}</p>`:""}
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Company</th><th>City / town</th><th>Type</th><th>Map status</th><th></th></tr></thead><tbody>
      ${page.rows.map(r=>`<tr><td><strong>${esc(r.data.name)}</strong><div class="subtle">${esc(r.data.address)}</div></td><td>${esc(r.data.city||"—")}</td><td>${esc(r.data.type||"Venue")}</td><td>${esc(r.data.catalogueVenueId?"On map":r.publish_state==="skipped"?"Needs review":r.publish_state==="working"?"Checking address":"Not published")}</td><td>${btn("details","Details",`data-id="${esc(r.id)}"`)}</td></tr>`).join("")||`<tr><td colspan="5">${loading?"Loading companies…":"No companies match this search."}</td></tr>`}</tbody></table></div>
      <div class="company-pagination"><span>${loading?"Loading…":`${number(page.total?offset+1:0)}–${number(Math.min(offset+50,page.total))} of ${number(page.total)}`}</span><div>${btn("prev","Previous",offset===0||loading?"disabled":"")}${btn("next","Next",offset+50>=page.total||loading?"disabled":"")}</div></div>`;
    }
    function paint() { const el=document.getElementById("company-manager"); if(el) el.innerHTML=table(); }
    async function refresh() {
      if (loading || !allowed()) return;
      loading=true;pageError="";const g=generation;paint();
      try { const data=await rpc("crm_company_list",{p_search:search,p_view:view,p_offset:offset}); if(g===generation){page=data;loaded=true;loadedAt=Date.now();} }
      catch(e){ if(g===generation)pageError=e.message; }
      finally {if(g===generation){loading=false;paint();}}
    }
    function parser(action,payload={},transfer=[]) {
      if (!worker) return Promise.reject(new Error("Choose the spreadsheet again to resume."));
      const id=++requestId;
      return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,action,payload},transfer);});
    }
    function stopWorker() { worker?.terminate();worker=null;pending.forEach(p=>p.reject(new Error("File reading cancelled")));pending.clear(); }
    function download(name,content,type="text/csv;charset=utf-8") {
      const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }
    function diagnostics(m) {
      const d=m.diagnostics;if(!d)return "";
      const stages={claim:"Database: claim company",screen:"AI research & correction",publish:"Publishing service (includes address checks)",save:"Database: save result"};
      const seconds=ms=>(ms/1000).toFixed(2)+"s";
      const last=d.errors[0];
      return `<section class="company-notice"><h3>Publishing diagnostics</h3><p>${number(d.retries)} retries · ${number(d.slowdowns)} slowdowns · ${number(d.recoveries)} recovery steps</p>
      <p>Latest failure: ${last?esc(last.stageLabel+" — "+last.cause):"None recorded in this session"}</p>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Stage</th><th>Calls / failed</th><th>Average / slowest</th></tr></thead><tbody>${Object.entries(stages).map(([key,name])=>{const t=d.stages[key];return `<tr><td>${name}</td><td>${number(t.calls)} / ${number(t.failed)}</td><td>${seconds(t.calls?t.total/t.calls:0)} / ${seconds(t.max)}</td></tr>`;}).join("")}</tbody></table></div>
      <p>Timings include network travel. Publishing-service time combines its internal steps; it cannot by itself identify the address provider or Cloudflare as the cause.</p>
      ${d.errors.slice(0,3).map(e=>`<p><strong>${esc(e.at)} · ${esc(e.stageLabel)}</strong><br>${esc(e.message)}${e.status?` · HTTP ${e.status}`:""}${e.code?` · Code ${esc(e.code)}`:""}${e.requestId?`<br>Request ID: ${esc(e.requestId)}`:""}</p>`).join("")}
      ${btn("diagnostics","Download diagnostics")}</section>`;
    }
    function dialog() {
      let el=document.getElementById("company-dialog");
      if (!modal) {el?.close();el?.remove();return;}
      if(!el){el=document.createElement("dialog");el.id="company-dialog";el.className="company-dialog";el.addEventListener("cancel",e=>{e.preventDefault();if(!active)close();});document.body.append(el);}
      const m=modal; let body="";
      if(m.kind==="import") {
        body=`<h2>Add businesses from Excel or CSV</h2><p>Choose one worksheet, check the columns, then confirm. A backup is created before the first batch. Existing companies are kept.</p>
        ${m.file?`<div class="company-notice"><strong>${esc(m.file)}</strong> · ${esc(m.size)} MB</div>`:`<label>Excel or CSV file (up to 50 MB)<input type="file" data-company-file accept=".xlsx,.xls,.csv"></label>`}
        ${m.sheets?`<label>Worksheet to import<select data-company-sheet ${active?"disabled":""}><option value="">Choose one worksheet…</option>${m.sheets.map(s=>`<option ${m.sheet===s?"selected":""} value="${esc(s)}">${esc(s)}</option>`).join("")}</select></label><p>Only the selected worksheet is read as company data. For the Spain workbook, select <strong>Companies</strong>.</p>`:""}
        ${m.headers?`<p>${number(m.total)} data rows in <strong>${esc(m.sheet)}</strong>. The first row supplies the column names.</p><div class="company-mapping">${fields.map(f=>`<label>${label[f]}<select data-company-map="${f}" ${active?"disabled":""}><option value="-1">Do not import</option>${m.headers.map((h,i)=>`<option value="${i}" ${m.mapping[f]===i?"selected":""}>${esc(h||`Column ${i+1}`)}</option>`).join("")}</select></label>`).join("")}</div><p>Incoming status, owner, creation date and map-link columns are ignored. New records start as prospects and remain unpublished.</p>${!m.preview&&!m.job?btn("preview","Check rows & preview",active?"disabled":""):""}`:""}
        ${m.preview&&!m.job?`<div class="company-notice"><strong>${number(m.preview.valid)}</strong> valid rows; <strong>${number(m.preview.invalid)}</strong> invalid rows will be skipped. Duplicates are checked against the database during import using name and address. Shared websites or emails alone do not count as duplicates.</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Row</th><th>Business</th><th>Address</th><th>City</th><th>Check</th></tr></thead><tbody>${m.preview.sample.map(r=>`<tr><td>${r.sourceRow}</td><td>${esc(r.displayName)}</td><td>${esc(r.address)}</td><td>${esc(r.city)}</td><td>${esc(r.error||"Valid")}</td></tr>`).join("")}</tbody></table></div><p>Preview shows the first 20 rows. No companies have been added yet.</p>${btn("commit",`Confirm: add up to ${number(m.preview.valid)} companies`,active||!m.preview.valid?"disabled":"")}`:""}
        ${m.job?`<p><strong>${number(m.job.processed)} / ${number(m.job.total_rows)}</strong> rows checked</p><progress class="company-progress" value="${m.job.processed}" max="${m.job.total_rows}"></progress><p>${number(m.job.inserted)} added · ${number(m.job.duplicates)} duplicates skipped · ${number(m.job.invalid)} invalid</p><p>${m.job.status==="complete"?"Import complete. Companies are ready to review and publish separately.":active?"Keep this tab open. You can pause after the current batch.":"Progress is saved. Resume here, or choose this same file and worksheet again after reopening."}</p>${active?btn("pause","Pause after this batch"):m.job.status!=="complete"?btn("resume","Resume import"):""}${btn("issues","Download skipped-row report",`data-id="${m.job.id}" ${active?"disabled":""}`)}`:""}`;
      } else if(m.kind==="history") {
        body=`<h2>Backups & import history</h2><p>Backups contain CRM companies. Restore brings back missing or archived companies and preserves current edits and map listings. Undo removes only untouched, unpublished additions from one import.</p>${btn("backup","Create company backup",active?"disabled":"")}<h3>Imports</h3>${(m.history?.imports||[]).map(j=>`<div class="company-history-item"><strong>${esc(j.file_name)} · ${esc(j.sheet_name)}</strong><small>${esc(new Date(j.created_at).toLocaleString())} · ${esc(j.status)}<br>${number(j.processed)}/${number(j.total_rows)} checked · ${number(j.inserted)} added · ${number(j.duplicates)} duplicates · ${number(j.invalid)} invalid${j.undone?` · ${number(j.undone)} undone · ${number(j.protected)} protected`:""}</small>${j.status==="running"?btn("import","Choose file to resume"):""}${btn("issues","Skipped-row CSV",`data-id="${j.id}"`)}${j.status!=="undone"?btn("undo","Undo this import",`data-id="${j.id}" ${active?"disabled":""}`):""}</div>`).join("")||"<p>No imports yet.</p>"}<h3>Saved company backups</h3>${(m.history?.backups||[]).map(b=>`<div class="company-history-item"><strong>${esc(b.label)}</strong><small>${esc(new Date(b.created_at).toLocaleString())} · ${number(b.row_count)} companies</small>${btn("restore","Restore missing companies",`data-id="${b.id}" ${active?"disabled":""}`)}${btn("download-backup","Download backup",`data-id="${b.id}" ${active?"disabled":""}`)}</div>`).join("")||"<p>No backups yet.</p>"}`;
      } else if(m.kind==="publish") {
        body=`<h2>${m.review?"AI screen & publish unpublished companies":"Publish companies to map"}</h2>${m.review?`<p>Research and clean addresses for companies needing review, across all pages and filters. Supported corrections are saved before publishing is attempted. Unresolved records stay in review without another publishing attempt.</p><p>AI checks use your API credits. AkiPasa also has a separate monthly cap. Manage it in <a href="#/crm/ai-team">AI Team → Usage & budget</a>.</p>${m.budget?`<p>Internal usage estimate: €${Number(m.budget.spent).toFixed(4)} / €${Number(m.budget.limit).toFixed(2)}. ${number(m.budget.count)} companies available to retry.</p>`:""}<p>Review runs start at 2 simultaneous checks and pace new attempts to avoid flooding the AI service.</p>`:""}<p>Addresses are verified through the existing publishing service. Successful businesses become unclaimed venues. Ambiguous addresses are saved for review.</p><label>Simultaneous checks (1–100)<input type="number" inputmode="numeric" min="1" max="100" step="1" data-company-concurrency value="${esc(m.concurrency)}" ${active?"disabled":""}></label><p>Set how many businesses can be checked at once. Pause to change this number.</p>${active?`<p>Current limit: ${number(m.currentLimit)} simultaneous checks.</p>`:""}<p>Up to ${number(m.concurrency)} parallel checks, with individual retries for isolated errors, smaller reductions for repeated failures, and automatic recovery. Progress is saved after each company. Keep this tab open, or pause and resume later.</p><p><strong>${number(m.checked)}</strong> checked in this session · ${number(m.published)} published or linked · ${number(m.skipped)} need review</p>${active?btn("pause","Pause after current checks"):btn("run-publish",m.started?"Resume publishing":"Start publishing")}`;
      } else if(m.kind==="details") {
        const r=m.record;
        body=`<h2>Company details</h2><form data-company-edit><div class="company-mapping">${fields.filter(f=>!["source","externalId"].includes(f)).map(f=>`<label>${label[f]}<input name="${f}" value="${esc(r.data[f]||"")}" ${!ctx.admin()?"readonly":""}></label>`).join("")}</div><p>Source: ${esc(r.data.source||"—")}<br>Reference: ${esc(r.data.externalId||r.id)}</p>${r.publish_error?`<p class="company-error">${esc(r.publish_error)}</p>`:""}<p>${r.data.catalogueVenueId?"This company is on the map. Editing these details changes the CRM record; the public venue is managed separately.":"Not yet published. Saving a corrected address makes it eligible for publishing again."}</p>${ctx.admin()?`<button class="action-btn primary" type="submit" ${active?"disabled":""}>Save CRM details</button> ${btn("archive","Archive from CRM",active?"disabled":"")}`:""}</form>`;
      }
      if(m.kind==="publish")body+=diagnostics(m);
      el.innerHTML=body+(m.message?`<p role="status" class="company-notice">${esc(m.message)}</p>`:"")+(m.error?`<p role="alert" class="company-error">${esc(m.error)}</p>`:"")+`<div class="company-dialog-actions">${btn("close","Close",active?"disabled":"")}</div>`;
      if(!el.open)el.showModal();
    }
    function close(){ if(active)return;modal=null;stopWorker();dialog(); }
    function openImport(){ if(active)return;stopWorker();modal={kind:"import"};dialog(); }
    async function readFile(file) {
      if(!file)return;if(!/\.(xlsx|xls|csv)$/i.test(file.name)||file.size>50*1024*1024)throw new Error("Choose an Excel or CSV file up to 50 MB.");
      stopWorker();modal={kind:"import",file:file.name,size:(file.size/1024/1024).toFixed(1),message:"Reading worksheet names…"};active=true;dialog();
      worker=new Worker("assets/company-import-worker.js?v=1");
      worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.error?p.reject(new Error(e.data.error)):p.resolve(e.data.result);};
      worker.onerror=()=>{pending.forEach(p=>p.reject(new Error("Spreadsheet reader stopped. Try again on a desktop browser.")));pending.clear();};
      try{const bytes=await file.arrayBuffer();Object.assign(modal,await parser("open",{bytes},[bytes]));modal.message="";}finally{active=false;dialog();}
    }
    async function chooseSheet(sheet) {
      if(active||!sheet)return;const m=modal;Object.assign(m,{sheet,headers:null,preview:null,job:null,error:"",message:"Reading the selected worksheet…"});active=true;dialog();
      try{Object.assign(m,await parser("sheet",{sheet}));m.message="";}finally{active=false;dialog();}
    }
    async function preview(){active=true;modal.error="";dialog();try{modal.preview=await parser("preview",{mapping:modal.mapping});}finally{active=false;dialog();}}
    async function runImport(start=false) {
      if(active)return;active=true;paused=false;modal.error="";modal.message="";dialog();
      try {
        if(start)modal.job=await rpc("crm_company_import_start",{p_hash:modal.hash,p_file:modal.file,p_sheet:modal.sheet,p_mapping:modal.mapping,p_total:modal.total});
        if(["undoing","undone"].includes(modal.job.status))throw new Error("This import was undone. Choose the file again to start a new import.");
        while(!paused&&modal.job.status!=="complete") {
          const rows=await parser("batch",{mapping:modal.mapping,offset:modal.job.processed});
          modal.job=await rpc("crm_company_import_batch",{p_id:modal.job.id,p_offset:modal.job.processed,p_rows:rows});dialog();
        }
      } finally {active=false;dialog();void refresh();}
    }
    async function history(){modal={kind:"history",message:"Loading saved history…"};dialog();modal.history=await rpc("crm_company_history");modal.message="";dialog();}
    async function rowsDownload(table,filter,name,columns) {
      const chunks=[columns.map(csv).join(",")+"\r\n"];let start=0;
      for(;;){let q=ctx.client().from(table).select("*");for(const [key,value] of Object.entries(filter))q=q.eq(key,value);
        if(table==="crm_company_records")q=q.is("deleted_at",null);
        const {data,error}=await q.order(table==="crm_company_import_issues"?"source_row":"seq").range(start,start+499);if(error)throw error;
        for(const r of data||[])chunks.push(columns.map(c=>csv(r.data?r.data[c]:r[c])).join(",")+"\r\n");
        if((data||[]).length<500)break;start+=500;
      }download(name,"\ufeff"+chunks.join(""));
    }
    async function publish(review=false){if(active)return;modal={kind:"publish",review,concurrency:review?2:50,checked:0,published:0,skipped:0};dialog();if(review){const m=modal;m.budget=await rpc("crm_company_review_retry");if(modal===m)dialog();}}
    async function runPublish(){
      if(active)return;
      const selected=Number(document.querySelector("[data-company-concurrency]")?.value);
      if(!Number.isInteger(selected)||selected<1||selected>100){modal.error="Enter a whole number from 1 to 100.";dialog();return;}
      modal.concurrency=selected;modal.currentLimit=selected;
      const run=modal,epoch=generation,current=()=>generation===epoch&&modal===run;
      run.diagnostics ||= {startedAt:new Date().toISOString(),retries:0,slowdowns:0,recoveries:0,errors:[],stages:Object.fromEntries(["claim","screen","publish","save"].map(k=>[k,{calls:0,failed:0,total:0,max:0}]))};
      const d=run.diagnostics;
      const stageLabels={claim:"Database claim",screen:"AI research & correction",publish:"Publishing service",save:"Database save"};
      const measure=async(stage,fn)=>{
        const started=Date.now();const t=d.stages[stage];
        try{return await fn();}catch(e){
          t.failed++;
          const message=String(e.message||e).slice(0,500);
          const status=Number(e.status)||Number(message.match(/Gateway request failed \((\d+)\)/)?.[1])||0;
          const cause=stage==="screen"?"AI screening failed":stage!=="publish"?"Supabase request failed":/Spanish address provider is unavailable/i.test(message)?"Address provider reported unavailable":status===429?"HTTP rate limit; originating service not confirmed":/Failed to fetch|NetworkError|Load failed/i.test(message)?"Network/CORS failure; service not confirmed":status>=500?"Gateway/server failure; originating service not confirmed":"Request failed; see original error";
          d.errors.unshift({at:new Date().toISOString(),stage,stageLabel:stageLabels[stage],cause,message,status,code:String(e.code||"").slice(0,120),requestId:String(e.requestId||"").slice(0,120)});d.errors.length=Math.min(d.errors.length,20);
          throw e;
        }finally{const ms=Math.max(0,Date.now()-started);t.calls++;t.total+=ms;t.max=Math.max(t.max,ms);}
      };
      active=true;paused=false;run.started=true;run.error="";run.message="";dialog();
      let nextReviewAttempt=0;
      let cooldown=0,backoff=15000,limit=selected,inFlight=0,healthySince=Date.now(),healthySuccesses=0;
      const wait=()=>new Promise(resolve=>setTimeout(resolve,250));
      let outcomes=[];
      const recordOutcome=failed=>{
        const now=Date.now();outcomes=outcomes.filter(o=>now-o.at<30000);
        outcomes.push({at:now,failed});outcomes=outcomes.slice(-100);
        d.recentRequests=outcomes.length;d.recentFailures=outcomes.filter(o=>o.failed).length;
      };
      const temporary=error=>/Spanish address provider is unavailable|Gateway request failed \((429|502|503|504)\)|too many requests|rate limit|AI concurrency limit reached/i.test(error);
      const recover=e=>{
        const status=Number(e.status)||Number(String(e.message||e).match(/Gateway request failed \((\d+)\)/)?.[1]);
        const retryAfter=Number.isFinite(e.retryAfterMs)?Math.max(0,e.retryAfterMs):0;
        const rateLimited=status===429||/too many requests|rate limit/i.test(e.message||"");
        const widespread=d.recentFailures>=5&&d.recentFailures/d.recentRequests>=0.1;
        if(!rateLimited&&!retryAfter&&!widespread){
          run.message=`Retrying an isolated publishing error; keeping ${limit} simultaneous checks. Original error: ${String(e.message||e).slice(0,500)}`;
          dialog();return;
        }
        healthySuccesses=0;healthySince=Date.now();
        if(Date.now()>=cooldown){
          cooldown=Date.now()+Math.max(backoff,retryAfter);backoff=Math.min(backoff*2,120000);
          d.slowdowns++;
          limit=Math.max(1,Math.floor(limit*0.8));run.currentLimit=limit;
          outcomes=[];d.recentRequests=0;d.recentFailures=0;
          run.message=`${rateLimited?"Rate limit reported":retryAfter?"Server requested a retry delay":"Repeated publishing failures"}. Retrying after a cooldown; reduced to ${limit} parallel checks. Original error: ${String(e.message||e).slice(0,500)}`;
        }else{
          // A later response can request a longer wait without another reduction.
          cooldown=Math.max(cooldown,Date.now()+retryAfter);
        }
        dialog();
      };
      const stop=e=>{if(current()){paused=true;run.message="Publishing paused after a service error: "+(/AI monthly budget exhausted/i.test(e.message)?"AkiPasa internal AI budget reached. Open AI Team → Usage & budget to review your cap; this is separate from OpenAI credit.":e.message)+". Interrupted checks become available again after 10 minutes.";dialog();}};
      const worker=async()=>{
        while(current()&&!paused){
          try{
            while(current()&&!paused&&(Date.now()<cooldown||inFlight>=limit))await wait();
            if(!current()||paused)return;
            // Atomic database leases prevent parallel workers claiming the same company.
            const claim=await measure("claim",()=>rpc("crm_company_publish_claim"));
            if(!current()||!claim)return;
            const deadline=Date.now()+480000;
            let error="",retryAt=0,screened=false;
            for(let attempt=0;;attempt++){
              while(current()&&!paused&&(Date.now()<Math.max(cooldown,retryAt)||inFlight>=limit)&&Date.now()<deadline)await wait();
              if(!current()||paused)return;
              if(Date.now()>=deadline){stop(new Error("Retry window exhausted; the address service has not recovered"));return;}
              if(run.review){
                const slot=Math.max(Date.now(),nextReviewAttempt);nextReviewAttempt=slot+1200;
                while(current()&&!paused&&Date.now()<slot)await wait();
                if(!current()||paused)return;
              }
              inFlight++;
              let retry=false;
              try{
              if(run.review&&!screened){
                const screening=await measure("screen",async()=>{
                  const {data:session,error:sessionError}=await ctx.client().auth.getSession();
                  if(sessionError||!session.session?.access_token)throw new Error("Sign in again before screening.");
                  const response=await fetch("https://akipasa.com/api/ai-team/company-screen",{method:"POST",headers:{Authorization:"Bearer "+session.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({id:claim.id,token:claim.token}),signal:AbortSignal.timeout(120000)});
                  const payload=await response.json();
                  if(!response.ok){const e=new Error(payload.message||payload.error||"AI screening failed");e.status=response.status;throw e;}
                  return payload.data;
                });
                if(screening.status!=="resolved"){
                  error="AI screening: "+(screening.note||"Address still needs manual review.");
                  d.screeningUnresolved=(d.screeningUnresolved||0)+1;
                  break;
                }
                claim.data=screening.company;screened=true;d.screeningResolved=(d.screeningResolved||0)+1;
              }
              const result=await measure("publish",()=>ctx.request("/api/crm/leads/publish-unclaimed?mode=batch",{method:"POST",body:{workspaceId:"ws_akipasa",company:claim.data},signal:AbortSignal.timeout(Math.min(120000,Math.max(1,deadline-Date.now())))}));
              error=result?.data?.reason||"";
              // The backend may return service failures as a successful HTTP response.
              if(/AI monthly budget exhausted|AI (minute|hourly) rate limit reached|AI concurrency limit reached/i.test(error))throw new Error(error);
              if(current())recordOutcome(false);
            }catch(e){
              error=e.message||String(e);
              if(!current())return;
              const transient=temporary(error)||[429,502,503,504].includes(e.status);
              recordOutcome(transient);
              if(transient&&attempt<4){
                d.retries++;recover(e);retry=true;
                // Only this leased company waits on an isolated failure.
                retryAt=Date.now()+Math.min(8000,1000*2**attempt)+Math.floor(Math.random()*500);
              }
              // Only this known record-level validation failure is safe to continue past.
              else if(!/normalized address could not be confirmed by the authoritative Spanish address provider/i.test(error)){
                stop(e);
                // Leave the lease recoverable, rather than classifying an outage as a bad address.
                return;
              }
            }finally{inFlight--;}
            if(!retry)break;
            }
            if(!current())return;
            const result=await measure("save",()=>rpc("crm_company_publish_finish",{p_id:claim.id,p_token:claim.token,p_error:error||null}));
            if(!current())return;
            run.checked++;result.published?run.published++:run.skipped++;
            if(!paused&&Date.now()>=cooldown&&++healthySuccesses>=25&&Date.now()-Math.max(healthySince,cooldown)>=30000&&limit<selected){
              limit=Math.min(selected,limit+Math.max(1,Math.ceil(selected/10)));run.currentLimit=limit;
              healthySuccesses=0;healthySince=Date.now();backoff=15000;d.recoveries++;
              run.message=`Checks are succeeding again. Increased to ${limit} simultaneous checks (your maximum: ${selected}).`;
            }
            dialog();
          }catch(e){stop(e);return;}
        }
      };
      try{
        if(run.review&&!run.prepared){
          run.budget=await rpc("crm_company_review_retry");
          let cursor=0,done=false,queued=0;
          while(current()&&!paused&&!done){
            const batch=await rpc("crm_company_review_retry",{p_requeue:true,p_after:cursor,p_until:run.budget.until});
            cursor=batch.cursor;done=batch.done;queued+=batch.queued;
            run.message=`${number(queued)} companies queued for AI research and address cleaning…`;dialog();
          }
          if(!current()||paused)return;
          run.prepared=true;
        }
        // Workers handle their own failures; all in-flight checks drain before resume is enabled.
        await Promise.allSettled(Array.from({length:selected},()=>worker()));
        if(current()&&!paused)run.message="No more pending companies. Check the ‘Publishing needs review’ filter for skipped addresses. Interrupted checks become available again after 10 minutes.";
      }catch(e){stop(e);}finally{if(current()){active=false;dialog();void refresh();}}
    }
    async function action(action,target) {
      if(action==="pause"){paused=true;modal.message="Pausing after current requests finish… Interrupted checks become available again after 10 minutes.";dialog();return;}
      if(action==="close"){close();return;}if(action==="diagnostics"&&modal?.diagnostics){download("publishing-diagnostics.json",JSON.stringify(modal.diagnostics,null,2),"application/json");return;}if(active)return;
      if(action==="import")return openImport();
      if(action==="preview")return preview();if(action==="commit")return runImport(true);if(action==="resume")return runImport();
      if(action==="history")return history();if(action==="publish")return publish();if(action==="review-publish")return publish(true);if(action==="run-publish")return runPublish();
      if(action==="refresh")return refresh();if(action==="prev"||action==="next"){offset=Math.max(0,offset+(action==="next"?50:-50));return refresh();}
      if(action==="details"){modal={kind:"details",record:page.rows.find(r=>r.id===target.dataset.id)};dialog();return;}
      active=true;if(modal){modal.error="";modal.message="Working…";}dialog();
      try {
        const id=target.dataset.id;
        if(action==="issues") await rowsDownload("crm_company_import_issues",{import_id:id},"company-import-skipped.csv",["source_row","name","reason"]);
        if(action==="download-backup") await rowsDownload("crm_company_backup_rows",{backup_id:id},"company-backup.csv",["id","catalogueVenueId","name","email","website","phone","type","city","address","status","ownerId","source","createdAt"]);
        if(action==="backup"){const b=await rpc("crm_company_backup_create");modal.message=`Backup saved: ${number(b.rows)} companies.`;modal.history=await rpc("crm_company_history");}
        if(action==="undo"){
          if(!window.confirm("Undo this import? Only untouched, unpublished additions will be archived. Edited and published companies will be kept."))return;
          let j;do{j=await rpc("crm_company_import_undo",{p_id:id});modal.message=`${number(j.undone)} additions undone; ${number(j.protected)} protected.`;dialog();}while(j.status!=="undone");
          modal.history=await rpc("crm_company_history");void refresh();
        }
        if(action==="restore"){
          if(!window.confirm("Restore missing companies from this backup? Current records and public map listings will be kept."))return;
          let cursor=0,n=0,r;do{r=await rpc("crm_company_backup_restore",{p_id:id,p_cursor:cursor});cursor=r.cursor;n+=r.restored;modal.message=`${number(n)} companies restored.`;dialog();}while(!r.done);void refresh();
        }
        if(action==="archive"){
          if(!window.confirm("Archive this company from the CRM? Its public map listing will remain available."))return;
          await rpc("crm_company_backup_create",{p_label:"Before archiving: "+modal.record.data.name});
          await rpc("crm_company_save",{p_id:modal.record.id,p_revision:modal.record.revision,p_data:{},p_archive:true});modal.message="Company archived. Restore it from Backups & import history.";void refresh();
        }
        if(modal?.message==="Working…")modal.message="Download ready.";
      } finally {active=false;dialog();}
    }
    function failed(e){active=false;if(modal){modal.error=e.message||String(e);modal.message="";dialog();}else ctx.toast("Company operation failed",e.message,"danger");}
    document.addEventListener("click",e=>{
      const legacy=e.target.closest('[data-action="open-prospect-import"]');
      const t=e.target.closest("[data-company-action]");
      if(!t&&!legacy)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      void action(t?.dataset.companyAction||"import",t||legacy).catch(failed);
    },true);
    document.addEventListener("change",e=>{
      const t=e.target;
      if(t.matches("[data-company-file]"))void readFile(t.files?.[0]).catch(failed);
      if(t.matches("[data-company-sheet]"))void chooseSheet(t.value).catch(failed);
      if(t.matches("[data-company-map]")){modal.mapping[t.dataset.companyMap]=Number(t.value);modal.preview=null;dialog();}
      if(t.matches("[data-company-concurrency]")&&!active&&modal?.kind==="publish"){modal.concurrency=t.value;modal.error="";}
      if(t.matches("[data-company-filter]")){view=t.value;offset=0;void refresh();}
    });
    document.addEventListener("submit",e=>{
      if(e.target.matches("[data-company-search]")){e.preventDefault();e.stopPropagation();search=new FormData(e.target).get("search").trim();offset=0;void refresh();}
      if(e.target.matches("[data-company-edit]")){
        e.preventDefault();e.stopPropagation();if(active||!ctx.admin())return;const data=Object.fromEntries(new FormData(e.target));active=true;
        void rpc("crm_company_save",{p_id:modal.record.id,p_revision:modal.record.revision,p_data:data}).then(d=>{ctx.saved?.(d);active=false;close();void refresh();}).catch(failed);
      }
    },true);
    window.addEventListener("beforeunload",e=>{if(active){e.preventDefault();e.returnValue="";}});
    return {
      render(){if((!loaded||Date.now()-loadedAt>30000)&&!loading)queueMicrotask(refresh);return `<section id="company-manager" class="panel table-panel">${table()}</section>`;},
      openImport,history,publish,
      exportCSV:()=>rowsDownload("crm_company_records",{workspace_id:"ws_akipasa"},"akipasa-companies.csv",["id","catalogueVenueId","name","email","website","phone","type","city","address","status","ownerId","source","createdAt"]),
      reset(){generation++;paused=true;active=false;stopWorker();modal=null;dialog();page={rows:[],total:0};loaded=false;loading=false;offset=0;search="";view="all";}
    };
  };
})();
