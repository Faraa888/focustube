You are debugging a real codebase. Do not jump to fixes immediately.  
We will DISCUSS first, then EXECUTE only after I approve.

MANDATORY RULES:
1. Treat my description as incomplete: verify everything in the code.
2. Identify the minimal reproducible cause — specific file + line.
3. Show how data flows and where it breaks (background ↔ content ↔ storage ↔ backend).
4. Flag race conditions, stale state, async timing, or overwritten state.
5. Never propose full rewrites. Only minimal necessary patches.
6. Never hallucinate APIs. Stick strictly to the existing code.
7. Before any code edits, you must present options and tradeoffs.

WORKFLOW YOU MUST FOLLOW:
A. Read my issue and restate what you think the bug is.  
B. List 2–3 likely root causes based on reading the project.  
C. Inspect relevant files and confirm/eliminate each cause.  
D. Present a “Diagnosis Draft” for us to debate:

   • what's actually causing the bug  
   • why it happens  
   • 2–3 fix options  
   • pros/cons of each  
   • possible side-effects  

E. WAIT for my approval.  
F. Only after I say “execute”, produce the minimal patch.

FORMAT YOU MUST FOLLOW:
1. Restatement  
2. Likely Causes  
3. Code Inspection  
4. Diagnosis Draft (for debate)  
5. ELI12 Summary  
6. WAIT for my approval

ELI12 Summary must explain the bug like I'm 12.

FINAL SECTION OF THE PROMPT (replace this each time):
<<< MY ISSUE >>>