/* Humanoid.WalkSpeed/JumpPower bridge sync.
 * Run with: node test/physics.js */
"use strict";

const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path=require('path');

global.window={};
global.THREE={Vector3:class{
  constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; }
  lengthSq(){ return this.x*this.x+this.y*this.y+this.z*this.z; }
  normalize(){
    const l=Math.sqrt(this.lengthSq())||1;
    this.x/=l; this.y/=l; this.z/=l; return this;
  }
  multiplyScalar(s){ this.x*=s; this.y*=s; this.z*=s; return this; }
}};

vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../web/js/physics.js'),'utf8'));
const Humanoid=window.RBLXphysics.Humanoid;

const c={
  alive:true,
  velocity:{x:0,y:0,z:0},
  group:{position:{x:0,y:0,z:0},rotation:{y:0}},
  walkSpeed:30, jumpVelocity:70,
  onGround:true, groundLook:null,
  takeDamage(){},
};
const h=new Humanoid(c,{colliders:[]});
h.onGround=true;
h._sweep=()=>{};
h._vertical=()=>false;
h._groundProbe=()=>null;
h._pushOutDynamic=()=>{};
h._tryClimb=()=>false;

/* a script-set WalkSpeed reaches the movement solver */
h.step(1/60,{moveDir:{x:1,y:0,z:0},jump:false});
assert.strictEqual(h.walkSpeed,30);
assert.strictEqual(c.velocity.x,30);

/* a script-set JumpPower reaches the jump solver */
c.onGround=true; h.onGround=true;
h.step(1/60,{moveDir:{x:0,y:0,z:0},jump:true});
assert.strictEqual(h.jumpPower,70);
assert.strictEqual(c.velocity.y,70);

console.log('ALL PHYSICS TESTS PASSED');
