import { mouse, keyboard, Button, Key, Point } from '@nut-tree-fork/nut-js';
import { createServer, IncomingMessage, ServerResponse } from 'http';

mouse.config.mouseSpeed = 1500;
keyboard.config.autoDelayMs = 30;

const PORT = 3300;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};

async function handleRequest(body: any, action: string) {
  switch(action) {
    case 'click': await mouse.setPosition(new Point(body.x,body.y)); await mouse.click(Button.LEFT); return {success:true,action:'click',x:body.x,y:body.y};
    case 'type': await keyboard.type(body.text); return {success:true,action:'type'};
    case 'move': await mouse.setPosition(new Point(body.x,body.y)); return {success:true,action:'move'};
    case 'scroll': body.direction==='up'?await mouse.scrollUp(body.amount||3):await mouse.scrollDown(body.amount||3); return {success:true,action:'scroll'};
    case 'key': 
      const km: Record<string, Key> = {
        enter: Key.Return,
        escape: Key.Escape,
        tab: Key.Tab,
        space: Key.Space,
        backspace: Key.Backspace
      }; 
      const k = km[body.key?.toLowerCase() || '']; 
      if(k){
        await keyboard.pressKey(k);
        await keyboard.releaseKey(k);
      } 
      return {success:true,action:'key'};
    default: return {status:'online',agent:'hands'};
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse)=>{
  if(req.method==='OPTIONS'){res.writeHead(200,cors);res.end();return;}
  const action=req.url?.replace('/hands/','').replace('/hands','').split('?')[0]||'status';
  let body='';
  req.on('data', (c: Buffer | string) => body += c.toString());
  req.on('end',async()=>{
    try{
      const data=body?JSON.parse(body):{};
      const result=await handleRequest(data,action);
      console.log('[hands]',action,result);
      res.writeHead(200,cors);
      res.end(JSON.stringify(result));
    }catch(e: any){
      res.writeHead(500,cors);
      res.end(JSON.stringify({success:false,error:e.message}));
    }
  });
});

export function startHandsV2Server() {
  return server.listen(PORT,()=>{console.log('[hands] Hands Agent on http://localhost:'+PORT+' — CORS enabled');});
}

// Auto-start only if run directly
const isMain = process.argv[1] && (process.argv[1].endsWith('hands-agent-v2.ts') || process.argv[1].endsWith('hands-agent-v2.js'));
if (isMain) {
  startHandsV2Server();
}

