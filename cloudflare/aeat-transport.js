/** Node-side mTLS transport primitives. Not imported by the Worker/browser.
 * The immutable outbox dispatcher still needs deployment, protected certificate
 * custody and AEAT acceptance before the production fiscal gate can be removed.
 */
import {request as httpsRequest} from 'node:https';
import {SaxesParser} from 'saxes';
import {aeatDate,soapEnvelope,VERIFACTU_NAMESPACES} from './verifactu.js';
export const AEAT_ENDPOINTS=Object.freeze({test:'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',production:'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'});
const responseNS='https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd';
const maxBytes=1024*1024;
function parseXml(xml){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>maxBytes)throw Error('AEAT response exceeds supported size');
 const parser=new SaxesParser({xmlns:true}),stack=[];let root,nodes=0;
 parser.on('doctype',()=>{throw Error('DOCTYPE is forbidden in AEAT responses')});
 parser.on('processinginstruction',()=>{throw Error('Processing instructions are forbidden')});
 parser.on('error',e=>{throw e});
 parser.on('opentag',tag=>{if(++nodes>5000||stack.length>40)throw Error('AEAT XML exceeds structural limits');const n={name:tag.local,uri:tag.uri,text:'',children:[]};if(stack.length)stack.at(-1).children.push(n);else {if(root)throw Error('Multiple XML roots');root=n;}stack.push(n)});
 parser.on('text',text=>{if(stack.length)stack.at(-1).text+=text});parser.on('cdata',text=>{if(stack.length)stack.at(-1).text+=text});parser.on('closetag',()=>stack.pop());parser.write(xml).close();return root;
}
function one(parent,name,optional=false,uri=responseNS){
 const found=(parent?.children||[]).filter(c=>c.name===name);
 if(found.length>1||(!optional&&found.length!==1)||found.some(c=>c.uri!==uri))throw Error(`Invalid AEAT ${name} element`);
 return found[0];
}
const text=(parent,name,optional=false,uri=responseNS)=>{const n=one(parent,name,optional,uri);if(n?.children.length)throw Error('Unexpected nested response value');return n?.text.trim()||'';};
export function parseAcknowledgement(xml,expected){
 const root=parseXml(xml);
 if(root?.name!=='Envelope'||root.uri!==VERIFACTU_NAMESPACES.soap)throw Error('Expected SOAP envelope');
 const body=one(root,'Body',false,VERIFACTU_NAMESPACES.soap);
 if(body.children.some(c=>c.name==='Fault'))throw Error('AEAT SOAP fault; retain the response for reconciliation');
 const response=one(body,'RespuestaRegFactuSistemaFacturacion');
 if(body.children.length!==1)throw Error('Unexpected SOAP body');
 const header=one(response,'Cabecera'),issuer=one(header,'ObligadoEmision',false,VERIFACTU_NAMESPACES.info);
 if(text(issuer,'NIF',false,VERIFACTU_NAMESPACES.info)!==expected.issuer_nif)throw Error('AEAT header identity does not match issuer');
 const line=one(response,'RespuestaLinea'),identity=one(line,'IDFactura');
 for(const [field,wanted] of [['IDEmisorFactura',expected.issuer_nif],['NumSerieFactura',expected.document_number],['FechaExpedicionFactura',aeatDate(expected.issue_date)]])if(text(identity,field,false,VERIFACTU_NAMESPACES.info)!==wanted)throw Error('AEAT response identity does not match submitted record');
 const operation=one(line,'Operacion');if(text(operation,'TipoOperacion',false,VERIFACTU_NAMESPACES.info)!=='Alta')throw Error('Unexpected AEAT operation');
 const status=text(line,'EstadoRegistro'),global=text(response,'EstadoEnvio');
 if(!['Correcto','AceptadoConErrores','Incorrecto'].includes(status)||!['Correcto','ParcialmenteCorrecto','Incorrecto'].includes(global))throw Error('Unknown AEAT status');
 if((status==='Correcto'&&global!=='Correcto')||(status==='AceptadoConErrores'&&global!=='ParcialmenteCorrecto')||(status==='Incorrecto'&&global!=='Incorrecto'))throw Error('Conflicting AEAT overall and record statuses');
 const wait=text(response,'TiempoEsperaEnvio');if(!/^\d{1,6}$/.test(wait))throw Error('Invalid AEAT next-send interval');
 const duplicate=one(line,'RegistroDuplicado',true),csv=text(response,'CSV',true);
 if(status!=='Incorrecto'&&!/^[A-Za-z0-9]{16}$/.test(csv))throw Error('Accepted submission is missing its verification code');
 return {status:duplicate?'duplicate_requires_reconciliation':status==='Correcto'?'accepted':status==='AceptadoConErrores'?'accepted_with_errors':'rejected',csv:csv||null,retryAfterSeconds:Number(wait),errorCode:text(line,'CodigoErrorRegistro',true)||null,errorDescription:text(line,'DescripcionErrorRegistro',true)||null,duplicateState:duplicate?text(duplicate,'EstadoRegistroDuplicado',false,VERIFACTU_NAMESPACES.info):null,rawXml:xml};
}
export async function sendRegistration({registration,environment,expected,cert,key,pfx,passphrase},request=httpsRequest){
 if(!Object.hasOwn(AEAT_ENDPOINTS,environment)||registration.environment!==environment)throw Error('Explicit matching AEAT environment required');
 if((!pfx&&(!cert||!key))||(pfx&&(cert||key)))throw Error('One protected client certificate identity is required (PFX or PEM certificate/key)');
 const body=soapEnvelope(registration);if(Buffer.byteLength(body)>maxBytes)throw Error('Submission too large');
 const raw=await new Promise((resolve,reject)=>{
  const req=request(AEAT_ENDPOINTS[environment],{method:'POST',rejectUnauthorized:true,minVersion:'TLSv1.2',cert,key,pfx,passphrase,headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:'""','Content-Length':Buffer.byteLength(body)}},response=>{
   let length=0;const chunks=[];
   response.on('data',chunk=>{length+=chunk.length;if(length>maxBytes){response.destroy(Error('AEAT response too large'));return;}chunks.push(chunk)});
   response.on('error',reject);response.on('end',()=>{if(response.statusCode!==200){const e=Error(`AEAT HTTP ${response.statusCode}; outcome may be uncertain`);e.responseXml=Buffer.concat(chunks).toString('utf8');reject(e);return;}resolve(Buffer.concat(chunks).toString('utf8'))});
  });
  req.setTimeout(30000,()=>req.destroy(Error('AEAT request timed out; reconcile before repeating')));req.on('error',reject);req.end(body);
 });
 try{return parseAcknowledgement(raw,expected)}catch(e){e.responseXml=raw;throw e;}
}
