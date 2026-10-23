#!/bin/sh
# Runs a simulated season per arc and scans the told chapters for placeholder leftovers.
# Usage: sh scripts/story-check.sh [arc ...]
ARCS="${*:-lantern returner overlord slime shield gate misfits hidden}"
for a in $ARCS; do
  env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN STORY_ARC=$a npx tsx scripts/season-sim.ts 200 > /dev/null 2>&1
  node -e "
const {createClient}=require('@libsql/client');const c=createClient({url:'file:data/season-sim.db'});
(async()=>{const s=(await c.execute('SELECT MAX(season) m FROM story')).rows[0].m;
const r=await c.execute({sql:'SELECT chapter,title,text FROM novel WHERE season=? ORDER BY tick,ord',args:[s]});
let w=0,bad=0;for(const x of r.rows){const t=x.title+' '+x.text;w+=t.split(/\s+/).length;
 if(/someone|undefined|NaN|\[\[|\]\]|<[a-z_]+>|\{[a-zA-Z_]+\}/.test(t)){bad++;console.log('  BAD',x.chapter,(t.match(/.{0,40}(someone|undefined|NaN|\[\[|\]\]|<[a-z_]+>|\{[a-zA-Z_]+\}).{0,30}/)||[''])[0])}}
console.log('$a: season '+s+', '+r.rows.length+' beats, ~'+w+' words, '+bad+' with leftovers')})()"
done
