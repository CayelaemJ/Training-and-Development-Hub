import test from "node:test";import assert from "node:assert/strict";import {clashes,validSlot} from "../lib/timetablePolicy.ts";
const s={day:1,startsAt:"08:00",endsAt:"09:00",teacherId:"t1",room:"A1",grade:"5",group:"A"};
test("rejects timetable clashes across teacher room and class",()=>{assert.deepEqual(clashes(s,{...s,startsAt:"08:30",endsAt:"09:30"}),["teacher","room","class"]);assert.deepEqual(clashes(s,{...s,startsAt:"09:00",endsAt:"10:00"}),[]);assert.deepEqual(clashes(s,{...s,day:2}),[])});
test("validates strictly chronological classroom slots",()=>{assert.equal(validSlot(s),true);assert.equal(validSlot({...s,endsAt:"07:00"}),false);assert.equal(validSlot({...s,startsAt:"25:00"}),false)});
