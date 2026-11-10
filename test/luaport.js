/* Focused semantics tests for web/js/luaport.js.
 * Run with: node test/luaport.js
 * No browser, no DOM: the interpreter only needs a window object. */
"use strict";

const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path=require('path');

global.window={};
global.performance={ now:()=>0 };
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../web/js/luaport.js'),'utf8'));
const L=window.RBLXlua;

function run(src){
  L.makeEnv();
  let out=null;
  L.run(L.parse(src), r=>{ out=r; });
  L.sched.tick(0);
  assert(Array.isArray(out), 'chunk return values must be an array');
  return out;
}
function one(src){ return run(src)[0]; }

/* precedence: or is lower than and */
assert.strictEqual(one('return true or false and false'), true);
assert.strictEqual(one('return false and true or true'), true);

/* metatables written in Lua must be callable */
assert.strictEqual(one('local t=setmetatable({},{__index=function(t,k) return k.."!" end}) return t.foo'), 'foo!');
assert.strictEqual(one('local t=setmetatable({x=1},{__newindex=function(t,k,v) rawset(t,k,v*2) end}) t.y=5 return t.y'), 10);
assert.strictEqual(one('local t=setmetatable({x=1},{__newindex={x=9}}) t.x=5 return t.x'), 5);
assert.strictEqual(one('local t=setmetatable({x=1},{__index={y=9}}) return t.y'), 9);

/* iteration must cross array holes */
assert.strictEqual(one('local t={1,2,3} t[1]=nil local n=0 for k,v in pairs(t) do n=n+v end return n'), 5);

/* lexer details: decimal escapes and the long-string first newline */
assert.strictEqual(one('return "\\65"'), 'A');
assert.strictEqual(one('return [[\nX]]'), 'X');

/* the format conversions 2007 scripts use */
assert.strictEqual(one('return string.format("%i",5)'), '5');
assert.strictEqual(one('return string.format("%u",5)'), '5');
assert.strictEqual(one('return string.format("%o",8)'), '10');
assert.strictEqual(one('return string.format("%q","a\\nb")'), '"a\\nb"');

/* gsub table keys use the first capture, not the whole match */
assert.strictEqual(one('return (string.gsub("ab","(a)(b)",{a="X",ab="Y"}))'), 'X');

/* unpack's upper bound of 0 returns nothing */
assert.strictEqual(one('local t={1,2,3} return select("#",unpack(t,1,0))'), 0);

/* coroutine.wrap exists and propagates return values */
assert.strictEqual(one('local f=coroutine.wrap(function(a) return a+1 end) return f(4)'), 5);

/* an empty gmatch pattern terminates after one match per position */
assert.strictEqual(one('local n=0 for w in string.gmatch("ab","") do n=n+1 end return n'), 3);

console.log('ALL LUAPORT TESTS PASSED');
