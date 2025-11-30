When the trial plan switches to free mode:
   What works:
      - Video doesnt pause / AI not being sent
      - Shrt blocking worsk
      - Distracting visit is right

   What doesnt work:
      - Search is still 15
      - Refresh plan button means the focustube blocker appears for some reason
      - Blocked channels persist
      - 

AI Classification is questionable as to weather it works anymore (seems to have stopped working on pro accounts)

   - Needs to be a simpler fix for this
   - Distraction block cycle isnt working (the pop ups etc)
   - Because classification seems to have failed again?? All come back as netural for some reason??
   - Distracting overlay not appearing
   - What pulled you off track
   - Route cuase is the plan sync seemingly needs to be refreshed when you switch channels
   - Nudge still appearing in the corner (we dont want it appearing there)
   - The nudge pop up and deflection is all off
   - for some reaosn blocking on app works but doesnt appear in block channel list 
   - and then refrehsing again makes it break?
   - Keep failing to save to supabase
   - Having an issue with nudges
   - Having an issue with the refresh page
   - cant test that logic

Change FT slider from 1 min to 2 hours (better for testing)


Upgrade to pro button doesnt work on the shorts block overlay
Blocking button isnt adding to supabase - keep getting that error
Not able to pull the first channel name either?


TestA) Shorts and rec toggle works
Test b) works
test c) Works

Test 1: It pulls but needs the plan to refresh to have the channel work better
Test 2: Daily limit work
Test 3: Works
Test 4: Does not work (no spiral nudge or overlay -that whole this is off only the old nudge format appears)
Test 5: Timer perists 
Test 6: Kinda wokrs (but search isn't working correctly and fast log in log out makes account features work strangely) 
Test 7: Dashboard sync works
Test 8: 
Test 9: Works
Test 10: Works but the wrong journal nudge is appearing (we want to overscreen overlay - which we definitely had working at one point not sure why it is;t now)
Test 11: It works
Test 12: Haven't tested - less important that others need to come around to testing


curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"
Doesnt seem to sync the data I want to be syncing


Block channel button appearing on free


So a few things we need to do:


Make sure the pro and free features work properly


Make sure the pro and free features
And only display at the right time


make sure trial switches from proxy pro and free at the right time


Switching between the two is key to avoid any value leak (i.e. not paying customers getting free access)




Actual summary of issues:
- What is happening is that the AI classifications only work once you click reset conditions (realistically user doesn't know to do this)
- Once it happens the classification seems to work
- However, we are not getting the distracting / productive loop nudges and overlays appearing
- Block channel is not saving
- And furthermore the overall trial to free and pro feature sync is all a bit off
- we should ask and debate this in detail


Then there's a whole UI overlay and redesign that I ened to get to the bottom of

can we do this now please



Issue 1: Plan sync requires manual reset
Problem: Plan doesn't auto-refresh; user must click "reset conditions"
Fix:
Auto-refresh plan on navigation/channel switch
Verify plan check happens before AI classification
Ensure plan sync triggers automatically
Issue 2: AI classification works after reset
Problem: Works after reset, but user shouldn't need to reset
Fix:
Likely tied to Issue 1 (plan sync)
Verify plan is correct before sending to AI
Add logging to see what plan is used
Issue 3: Nudges/overlays not appearing
Problem: Classification works but distracting/productive nudges don't show
Fix:
Check nudge trigger logic (distracting/productive detection)
Verify overlay rendering code
Check if plan check is blocking nudges
Issue 4: Block channel not saving
Problem: Block button doesn't save to Supabase
Fix:
Check save endpoint error handling
Verify Supabase connection
Add error logging
Issue 5: Trial → Free/Pro sync broken
Problem: Features show at wrong times; search limit wrong
Fix:
Verify plan checks in all feature gates
Fix search limit logic (should be 5 for free, 15 for pro)
Hide "Block Channel" button on free