/* Focused bridge tests for web/js/rbxenv.js.
 * Run with: node test/rbxenv.js
 * No DOM or renderer: only the DataModel-facing paths are exercised. */
"use strict";

const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path=require('path');

global.window={};
global.performance={ now:()=>0 };
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../web/js/luaport.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../web/js/rbxenv.js'),'utf8'));
const L=window.RBLXlua, E=window.RBLXenv;

function run(env,src){
  let out=null;
  L.run(L.parse(src), r=>{ out=r; });
  L.sched.tick(0);
  assert(Array.isArray(out), 'chunk return values must be an array');
  return out;
}

/* walkAll includes the root and does not follow the fake Humanoid's
 * cross-parent limb aliases twice */
const model=E.mkInst('Model','M'), hum=E.mkInst('Humanoid','H'), part=E.mkInst('Part','P');
hum.parent=model; model.children.push(hum);
part.parent=model; model.children.push(part);
hum.children.push(part);                         /* alias, parent stays model */
assert.deepStrictEqual(E.walkAll(model).map(x=>x.props.Name), ['M','H','P']);

/* recursive FindFirstChild reaches a descendant */
E.forPlace({instances:[]}, null, null, null);
const findEnv=L.makeEnv({obj:E.wrap(model)});
assert.deepStrictEqual(run(findEnv,'return obj:FindFirstChild("P", true).Name'), ['P']);

/* Signal:wait blocks until the next firing */
const waitInst=E.mkInst('Part','WaitPart');
const waitW=E.wrap(waitInst);
const waitEnv=L.makeEnv({obj:waitW});
let waitResult=null;
L.run(L.parse('return obj.Touched:wait()'), r=>{ waitResult=r; });
L.sched.tick(0);
assert.strictEqual(waitResult,null,'wait must not return before a firing');
E.fireEvent(waitInst,'Touched',[waitW]);
L.sched.tick(0); L.sched.tick(0);
assert.ok(waitResult&&waitResult.length===1&&waitResult[0]===waitW,'wait returned '+JSON.stringify(waitResult));

/* ChildAdded wakes a waitForChild-style waiter when a child is parented */
const parent=E.mkInst('Model','Parent');
const childInst=E.mkInst('Part','Child');
const parentW=E.wrap(parent), childW=E.wrap(childInst);
const childEnv=L.makeEnv({obj:parentW});
let added=null;
L.run(L.parse('return obj.ChildAdded:wait()'), r=>{ added=r; });
L.sched.tick(0);
E.reparent(childInst,parent);
L.sched.tick(0); L.sched.tick(0);
assert.ok(added&&added.length===1&&added[0]===childW,'ChildAdded waiter did not return the child');

/* Players.PlayerAdded and the local player's class */
const gameEnv=L.makeEnv({game:E.wrap(E.state.gameInst)});
assert.deepStrictEqual(run(gameEnv,'return game.Players.LocalPlayer.ClassName'), ['Player']);
const addEnv=L.makeEnv({game:E.wrap(E.state.gameInst)});
addEnv.G.set('count',0);
L.run(L.parse('game.Players.PlayerAdded:connect(function(p) count=count+1 end)'), ()=>{});
L.sched.tick(0);
E.firePlayerAdded();
L.sched.tick(0); L.sched.tick(0);
assert.strictEqual(addEnv.G.get('count'),1,'PlayerAdded handler did not fire');

/* Lighting.TimeOfDay and GetMinutesAfterMidnight stay in sync */
const lightEnv=L.makeEnv({lighting:E.wrap(E.state.lightingInst)});
assert.deepStrictEqual(run(lightEnv,'lighting.TimeOfDay="18:30:00" return lighting:GetMinutesAfterMidnight()'), [1110]);
const lightEnv2=L.makeEnv({lighting:E.wrap(E.state.lightingInst)});
assert.deepStrictEqual(run(lightEnv2,'lighting:SetMinutesAfterMidnight(60) return lighting.TimeOfDay'), ['01:00:00']);

/* SoundId string round-trip */
const soundEnv=L.makeEnv({snd:E.instanceNew('Sound')});
assert.deepStrictEqual(run(soundEnv,'snd.SoundId="rbxasset://sounds/clickfast.wav" return snd.SoundId'), ['rbxasset://sounds/clickfast.wav']);

/* ObjectValue reads its instance as a wrapped value */
const ovEnv=L.makeEnv({ov:E.instanceNew('ObjectValue'), part:E.instanceNew('Part')});
assert.deepStrictEqual(run(ovEnv,'ov.Value=part return ov.Value==part'), [true]);

/* spawnFromXml keeps a multi-part model's relative offsets */
E.state.world=null;
const root={cls:'Part',props:{Name:'A',CFrame:{pos:{x:1,y:0,z:0},rot:[1,0,0,0,1,0,0,0,1]}},children:[],parent:null};
const child={cls:'Part',props:{Name:'B',CFrame:{pos:{x:3,y:0,z:0},rot:[1,0,0,0,1,0,0,0,1]}},children:[],parent:root};
root.children.push(child);
window.RBLXxml={parseRbx:()=>({instances:[root,child]})};
const made=E.spawnFromXml('x',{cf:{pos:{x:10,y:0,z:0},rot:[1,0,0,0,1,0,0,0,1]}});
assert.ok(made&&made.length===1);
assert.strictEqual(root.props.CFrame.pos.x,10);
assert.strictEqual(child.props.CFrame.pos.x,12);

console.log('ALL RBXENV TESTS PASSED');
