const fs = require('fs');
const games = ['mini-sudoku', 'sliding-puzzle', 'tangram', 'memory-flip'];

for (const g of games) {
  const f = 'src/games/' + g + '/index.ts';
  let c = fs.readFileSync(f, 'utf8');
  
  if (c.includes('this.roundsDone += 1')) {
    console.log(g + ': already has multiround');
    continue;
  }
  
  // Pattern: this.trackTimeout(() => this.finishClear(ARGS), DELAY)
  // Replace with: this.trackTimeout(() => { this.roundsDone += 1; if (this.roundsDone >= this.roundTotal) this.finishClear(ARGS); else this.startRound(); }, DELAY)
  
  const regex = /this\.trackTimeout\(\(\)\s*=>\s*this\.finishClear\(([^)]+)\),\s*(\d+)\)/g;
  const replacement = 'this.trackTimeout(() => { this.roundsDone += 1; if (this.roundsDone >= this.roundTotal) this.finishClear($1); else this.startRound(); }, $2)';
  
  const newCode = c.replace(regex, replacement);
  
  if (newCode !== c) {
    fs.writeFileSync(f, newCode);
    console.log(g + ': patched trackTimeout+finishClear');
  } else {
    // Try direct finishClear without trackTimeout
    const regex2 = /this\.finishClear\(([^)]+)\)/g;
    const replacement2 = 'this.roundsDone += 1; if (this.roundsDone >= this.roundTotal) this.finishClear($1); else this.startRound();';
    const newCode2 = c.replace(regex2, replacement2);
    if (newCode2 !== c) {
      fs.writeFileSync(f, newCode2);
      console.log(g + ': patched direct finishClear');
    } else {
      console.log(g + ': NO MATCH FOUND');
    }
  }
}
