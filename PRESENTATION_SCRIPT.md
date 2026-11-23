# NeuroSwarm: Presentation Script (4 speakers)

**Length:** about 20 minutes, 4 to 5 minutes each, then questions together.

**One rule for everyone:** for each algorithm, say the number, and say why a bio-inspired
algorithm was needed there. Those two things are what the examiners are looking for.

| Speaker | Covers | On screen | Time |
|---|---|---|---|
| **Person 1** | Intro, the problem, why there is no LLM, app demo | Login, patient chart, assistant | 4 min |
| **Person 2** | GA and PSO: search ranking and task order | Bio-Lab: GA and PSO chapters | 5 min |
| **Person 3** | AIS and Binary GA: typo checks and compression | Bio-Lab: AIS and Binary GA chapters | 5 min |
| **Person 4** | ACO, how it fits together, safety, tests, closing | Bio-Lab: ACO chapter and Overview | 5 min |

**Before you start:** backend running (`venv\Scripts\python.exe run.py`), frontend running
(`npm run dev`). Log in as Dr. Arvind Sharma in one tab and open the Bio-Lab in another, so
nobody has to watch a page load.

**Bio-Lab tips:** each chapter has a guided story on the right. Click **Next** and the 3D
scene moves to match. The caption at the bottom of the scene says what is happening at that
moment. Press **F** for full screen and **Shift + arrow keys** to change chapter.

---

## Person 1: Introduction and the app

### Opening (45 sec)

> Good morning. Our project is NeuroSwarm, a hospital records and care system.
> The records system itself is not the main point. The main point is that five everyday
> decisions inside it are made by algorithms copied from nature, instead of by rules we
> wrote by hand.
>
> Which note a doctor sees first. Which task a nurse does first. Whether a vital sign
> was typed wrong. Each of these is a decision, and each one is tuned by a different
> bio-inspired algorithm.

### The problem (1 min)

> A doctor at the bedside has maybe thirty seconds. The patient's history is dozens of
> notes. If they ask "what antibiotic is this patient on?", the system has to find that
> answer, not twenty notes that mention antibiotics.
>
> The obvious fix is a set of simple rules: sort by date, sort by priority, flag anything
> out of range. We built exactly that first. That is our baseline, and every number today
> is compared with it.

### Why there is no language model (1 min)

> There is no large language model anywhere in this system. An earlier version used one to
> write its answers. We took it out for three reasons.
>
> One: it cannot make things up. Every sentence the doctor sees is copied from a real note,
> so there is no step that could invent a dose.
>
> Two: you can see the ranking work. If a language model rewrites the answer, good ranking
> and bad ranking end up sounding the same. Without it, better ranking means a better answer.
>
> Three: a genetic algorithm needs a score that gives the same result every time. A language
> model gives a different answer each time and takes a second to respond, which is a bad
> thing to put inside a loop that runs thousands of times.

### Demo (1 min 30)

*Say what you click, not what the code does.*

1. **Login screen.** "Admin, doctor and nurse accounts. One click to switch."
2. **Patients.** "80 patients with realistic notes: heart failure, pneumonia, dengue, TB,
   heart attacks, typhoid, malaria and more."
3. **Open Kamala Sundaram, click "Summarize this patient".** "Everything here is taken from
   her record. You can open the cited sources."
4. **Ask "What diuretic is the patient on?"** Point at the ACO and GA/PSO badges on the answer.
5. **Ask something unrelated, like "what is the capital of France?".** "It refuses. If the
   match is too weak it says nothing was found instead of guessing."
6. **Switch to Nurse Priya, open Care Tasks.** "This queue is ordered by one of our algorithms."

### Hand-off (15 sec)

> Everything you just saw is ordered, filtered or checked by an evolved policy, not a fixed
> rule. Person 2 will explain the first two algorithms.

---

## Person 2: Genetic Algorithm and Particle Swarm

*Screen: Bio-Lab, GA chapter. Click Next through the story while you talk. Then the PSO chapter.*

### The tools (45 sec)

> Two of our algorithms do most of the work. We wrote them ourselves; they are in
> `app/bio/common.py`.
>
> A genetic algorithm keeps a population of guesses. The better ones are picked as parents,
> their genes are mixed, and a few genes are changed at random. The best ones are always
> kept, so the best score never goes down.
>
> Particle swarm optimization sends a flock of guesses through the space. Each one is pulled
> towards the best spot it has found and the best spot the whole flock has found.

### Search ranking (2 min)

> When the doctor asks a question, several notes match. The old system ranked them on one
> thing: how similar the words were. But a good result also depends on how recent the note
> is, whether the exact drug name appears, and whether it is the right section. A question
> about the plan should show the Plan section.
>
> So each guess is a set of 14 numbers: how much to trust each clue, plus a few settings.
> Its score is how well it ranks questions where we already know the right note.
>
> Why a bio-inspired algorithm? The ranking score only changes when two results swap places.
> Move a weight a little and nothing changes, so there is no slope to follow and normal
> calculus-based methods do not work. And 14 settings is far too many to try every
> combination. A GA only needs to compare two guesses.
>
> We trained a GA and a PSO and raced them. The winner is used.
>
> **Result on 116 questions it never saw: ranking quality (nDCG@5) went from 0.69 to 0.92,
> a 32.5% improvement.**

*In the GA scene, point at Dr. Sharma's question on the right as the correct note moves to #1.*

### Nurse task order (1 min 30)

> The old task list was one SQL sort: by due time, then priority. But a charge nurse knows
> that an overdue medium task for a critical patient comes before a high-priority bath that
> is not due yet. A fixed sort cannot do that.
>
> Nurses cannot write that down as a formula, but they can easily say which of two tasks
> they would do first. So we trained on those pairs. Agreement with those choices jumps in
> steps, so again there is no slope, and again a GA handles it.
>
> **Result on unseen ward scenarios: agreement with the expert order went from 80.6% to
> 94.3%, and the most urgent task is now first 91% of the time instead of 61%.**

*Open "Try it on the real system" to show tonight's real queue, old order next to GA order.*

### PSO (30 sec)

*In the PSO chapter, click Next to the "Only follow the leader" step.*

> Here the flock is on a landscape with a decoy hill and a real peak. If the birds only
> follow the leader, they all crowd onto the decoy and get stuck. Balancing their own memory
> with the flock's is what lets them find the real peak.
>
> Person 3 takes the next two.

---

## Person 3: Artificial Immune System and Binary GA

*Screen: Bio-Lab, AIS chapter. Then Binary GA.*

### Catching typos in vital signs (2 min 30)

> Every vital sign a nurse enters is checked before it is trusted. If a nurse types a heart
> rate of 180 instead of 81, that typo should not set off an alarm.
>
> The idea comes from the thymus. The body makes T-cells at random, then destroys any that
> attack the body's own cells. The ones left only react to things that are not part of the
> body. This is called negative selection.
>
> In our system, "self" is the set of normal vital-sign readings. We create random
> detectors, throw away any that touch normal readings, and keep the rest.

*Click Next through "Destroy any cell that attacks self" and "The typo arrives".*

> Why this approach? A normal classifier needs examples of every kind of mistake, and nobody
> has those. This only needs normal data, so it can catch mistakes nobody listed.
>
> We tested it on six kinds of planted typos it never saw.
>
> **Result: it caught 90.3% of the typos with a 0.9% false alarm rate, one false alarm in
> 113 normal readings.** A low false alarm rate matters, because a checker that keeps
> crying wolf gets ignored.
>
> Some mistakes are simple to write as rules, like a value that is physically impossible,
> or diastolic higher than systolic. Those are handled by plain rules. The immune system
> covers the rest.

*Optional: in "Try it on the real system", show HR 180 (caught by the immune detector) and
BP 212 (not caught, because 212 is still a realistic value on this ward). Say this limit
out loud before anyone asks.*

### Making the search index smaller (2 min)

> To search by meaning, every piece of a note is stored as 384 numbers. Not all of them are
> useful for medical text.
>
> So each gene is a switch: keep this number or drop it. There are 2 to the power 384
> possible masks, far too many to try. Picking numbers one at a time also fails, because
> some numbers are only useful together. Crossover can keep useful groups together.
>
> **Result: 384 numbers down to 142, about 63% less memory, with search quality about the
> same.**
>
> To be clear about "about the same": this test set is only 18 questions, so results jump
> around between runs, from minus 6% to plus 13%. We cannot honestly call that an
> improvement. The memory saving is exact.

> Person 4 has the last algorithm and the system as a whole.

---

## Person 4: Ant Colony Optimization, the full system, and closing

*Screen: Bio-Lab, ACO chapter. Then the Overview.*

### Where to search first (2 min)

> Each patient's notes are split into 30 sections: note type times part of the note. A
> question about medicine rarely needs the section about symptoms. Searching everything
> every time is wasteful.
>
> Ants find food by leaving pheromone. Paths that work get more pheromone, and unused trails
> fade. Our ants are practice questions, and the food is the section that holds the answer.
>
> Why not just a fixed table? Because the fading matters. If a ward starts writing notes
> differently, a fixed table quietly keeps sending searches to the wrong place. With
> evaporation, old routes fade unless they keep working.
>
> **Result: 82% fewer chunks scanned, and the answer is in the searched sections 91% of the
> time.** When the narrow search looks weak, NeuroSwarm scans everything, so a miss costs a
> little time and never gives a wrong answer.

*In "Try it on the real system", ask a question and show which sections the ants chose.*

### How it fits together (1 min)

*Show the Overview chapter.*

> One question goes through everything: the ants choose sections, the search runs on the
> smaller index, the evolved recipe ranks the results, a similarity check refuses weak
> matches, and the answer is copied from the notes with citations. Vitals go through the
> immune check. Tasks go through the GA policy.
>
> Each algorithm is trained offline and saved as a file. If nothing is trained, each part
> falls back to the simple rule, so the app still works.

### Safety (45 sec)

> Each patient has their own search index, so one patient's notes cannot show up in another
> patient's answer. The similarity check refuses rather than guesses. And role permissions
> are checked in one central place on the server.

### Evidence (45 sec)

> There are 35 automated tests covering login, permissions, patient isolation, the refusal
> check, and the algorithms themselves. For example, each optimizer must reach a known best
> answer, and immune detectors must never cover a normal reading.
>
> The browser versions of the algorithms in the Bio-Lab are checked by a script too. For
> example, with elitism the best score never drops: zero drops across 12 runs, compared with
> 40 drops without it.

### Closing (30 sec)

> Five decisions in a working hospital system, each given to the algorithm that fits it: a
> score with no slope to a GA and PSO, human preferences to a GA, unknown typos to an immune
> system, a huge on/off search to a binary GA, and a route that needs to forget to an ant
> colony.
>
> Every number is measured on data the algorithm never saw, against the rule it replaced,
> and we have told you where the results are weak as well as where they are strong.
> Thank you. We are happy to take questions.

---

## Questions: who answers what

| Likely question | Who | Short answer |
|---|---|---|
| "Why not use ChatGPT or another LLM?" | P1 | It can make things up, it hides whether ranking is good, it gives different answers each time, and it is slow. Our search is about 99% of response time, so speed work actually shows. |
| "Why not gradient descent?" | P2 | Ranking quality and pairwise agreement only change in steps. There is no slope. |
| "How do you know it isn't overfitting?" | P2 | Every number is on a test set the algorithm never trained on. Run `python -m app.bio.cli train` to reproduce it. |
| "Where did the data come from?" | P1 | It is generated: 80 patients and 1,932 note chunks, with known answers built in. No real patient data. |
| "How do you test the immune system if it never sees errors?" | P3 | We train on normal readings only, then test on six kinds of planted typos it never saw. |
| "Does it catch every typo?" | P3 | No. A typo that lands on a realistic value, like BP 212 on this ward, can get through. That is why range rules run next to it. |
| "Is the compression gain real?" | P3 | The memory saving is exact. Accuracy is "about the same", because 18 test questions is too few to say more. Say this before they ask. |
| "What if the ants pick the wrong section?" | P4 | If the narrow search looks weak, it scans everything. A miss costs time, not a wrong answer. |
| "What would you do next?" | P4 | Test on a much bigger index, where routing and compression save more, and build a bigger test set for compression. |

**If you do not know an answer,** say so, and say what you would measure to find out.

---

## Rehearsal checklist

- [ ] Everyone can explain in one sentence: nDCG, Kendall tau, negative selection,
      evaporation, elitism, tournament selection.
- [ ] Person 1 has done the demo clicks at least twice, including the refused question.
- [ ] Everyone has clicked through their Bio-Lab story once.
- [ ] Say each hand-off line out loud in practice.
- [ ] Time one full run. If it is over 20 minutes, cut from "How it fits together", never
      from the "why bio-inspired" parts.
