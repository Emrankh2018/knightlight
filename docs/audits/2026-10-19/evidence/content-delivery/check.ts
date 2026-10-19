import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { loadAllCourses, countCourse } from '../../../scripts/lib/load-courses.ts';
const read = (p:string) => JSON.parse(readFileSync(p,'utf8'));
const { courses, issues } = loadAllCourses();
const catalog = read('public/data/courses/index.json');
const results:any = { sourceIssues:issues, courseCount:courses.length, courses:[], generatedMismatches:[], replayIssues:[], matingFindMoves:[] };
for(const {slug,course} of courses){
 if(!course)continue;
 const shipped = read(`public/data/courses/${slug}.json`);
 if(JSON.stringify(shipped)!==JSON.stringify(course)) results.generatedMismatches.push(slug);
 const {chapterList,...meta}=course;
 const expected={...meta,counts:countCourse(course)};
 if(JSON.stringify(catalog.find((e:any)=>e.slug===slug))!==JSON.stringify(expected))results.generatedMismatches.push(slug+'/catalog');
 results.courses.push({slug,reviewed:course.reviewed,...countCourse(course)});
 for(const chapter of chapterList)for(const lesson of chapter.lessons)for(const step of lesson.steps){
  const c=new Chess(step.fen);
  for(const m of step.moves){try{const played=c.move(m.san);if(played.from+played.to+(played.promotion??'')!==m.uci||c.fen()!==m.fen)results.replayIssues.push(step.id+':position');}catch{results.replayIssues.push(step.id+':illegal');}}
  if(step.type==='find-move'&&c.isCheckmate()){
   const initial=new Chess(step.fen);const mates=[];
   for(const move of initial.moves({verbose:true})){initial.move(move);if(initial.isCheckmate())mates.push(move.san);initial.undo();}
   results.matingFindMoves.push({slug,lesson:lesson.id,id:step.id,moves:step.moves.map(m=>m.san),initialMateInOne:mates});
  }
 }
}
const index=read('public/data/puzzles/index.json');let records=0,bytes=statSync('public/data/puzzles/index.json').size;const unique=new Map();const bad:any[]=[];const levels=[];
for(const level of index.levels){let count=0;const buckets=[];for(const b of level.buckets){const file='public/data/puzzles/'+b.file;const ps=read(file);bytes+=statSync(file).size;records+=ps.length;count+=ps.length;
if(ps.length!==b.count)bad.push({file,count:ps.length,expected:b.count});const ids=new Set();for(const p of ps){if(ids.has(p.id))bad.push({file,duplicate:p.id});ids.add(p.id);if(p.rating<level.min||p.rating>level.max)bad.push({file,rating:p.rating});if(b.theme!=='mixed'&&!p.themes.includes(b.theme))bad.push({file,theme:p.id});if(unique.has(p.id)&&JSON.stringify(unique.get(p.id))!==JSON.stringify(p))bad.push({file,inconsistent:p.id});unique.set(p.id,p);}buckets.push({theme:b.theme,count:ps.length});}levels.push({id:level.id,records:count,buckets});}
results.puzzles={records,unique:unique.size,bytes,levels,bad};
const openings=read('public/data/openings/openings.json').openings;const positions=read('public/data/openings/positions.json');const openingIssues=[];let transitions=0;
for(const [fen,entry] of Object.entries(positions) as any){const c=new Chess(fen+' 0 1');if(entry.o!==undefined&&(entry.o<0||entry.o>=openings.length))openingIssues.push({fen,index:entry.o});for(const [san,uci,after] of entry.n){transitions++;try{const m=c.move(san);if(m.from+m.to+(m.promotion??'')!==uci||c.fen().split(' ').slice(0,4).join(' ')!==after)openingIssues.push({fen,san,after});c.undo();}catch{openingIssues.push({fen,san,invalid:true});}}}
results.openings={count:openings.length,positions:Object.keys(positions).length,transitions,issues:openingIssues};
writeFileSync('.tmp/audit-2026-10-19/content-delivery/check-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({...results,courses:results.courses,matingFindMoves:results.matingFindMoves,puzzles:{records,unique:unique.size,bytes,bad},openings:results.openings},null,2));
