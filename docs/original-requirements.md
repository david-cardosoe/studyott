# Study Tracker Web Application

## Application Overview/Plan

I want to build a study tracker web app. I will outline some requirements, design choices, features, and overall structure for the app. Then we can both decide on what would be the best tech stack and architecture to use for this application to be hosted. I would like to host this application with a backend and authentication, though authentication will be limited to things like sign in with google so we do not have to manage usernames or passwords ourselves.

#### Requirements

The overall app will be simple with ability to change, upgrade, and add to the existing app later. For the first iteration I want 4 main pages/tabs where user can go.

Overall site structure: Will have 4 tabs that are clickable at the top to navigate too. If the screen is too small then they will collapse into a button that can be expanded open. I want this to be accessible on desktop and phone. The tabs are Home, Weekly History, Lifetime Overview, and Settings. The application will be named StudyOtt and I will provide a mascot image for it, as well as a color scheme for light and dark modes.

First Iteration Functionality: I will keep it simple on first iteration of the application. The application will store study data. An entry(which will be editable) will include the following {

- Time studied rounded to the minute (will be captured by stopwatch we implement or manual entry)
- Date
    - Date recorded or date put in by user for manual entries
- Time
    - Optional for manual entry
- Study Subject
    - Provide Default options in a dropdown but give user ability to type in own option and it will now appear in the dropdown as well
    - Default value will be last option used and if no option has ever been used then we can just populate with the top default option
- Note
    - Restricted to an appropriate amount of characters where user can leave a note about the session. Will be available before timer starts and when timer is paused to edit.
    - Can be entered when manually entering a new study session as well
- Date_Created: Keep record of when data entry was created, Always autofilled do not show or prompt user
- Date_Updated: Keep record of when data entry was, Always autofilled do not show or prompt user

Additional Data to store:

- Study Subjects can be added as I mentioned. This will be stored separately from the study entry. User can add new subjects that appear in the dropdown. They can also delete subjects they no longer want in the dropdown. The only dropdown they can not delete is the one that allows they to add a new study subject to the dropdown menu

Two Main ways to capture study session: Stopwatch, which will be in the homepage where they will be able to input the information above and start, pause, resume, and save the entry or restart the timer (will ask if they are sure they want to delete current study session). Second way is manual input. In the Home Page and Weekly history page there will be an add button(circular) in the top right where they can add a manual entry of the data I listed.

Editing: Will be available in Home Page and Weekly History. They are done on day views with the entries. They are able to edit Time Studied, Date, Time, Study Subject, and Note. Will have same or similar format to the manual entry form. Clarity: when looking at a week (Like in home page or when you click a week in the weekly history) it will show the days with the study sessions and that is where an edit button and delete button should exist. The edit button will provide a pop up window to edit and delete will bring up a pop up to ask if they are sure they want to delete.

Weekly Format View: This is how a week will be viewed, can be like card format or something similar to keep aesthetics clean and modern. This will appear under the stopwatch in the home page and this is how it will look when you click on a week in the Weekly History tab/page. It will show the days of the week (Monday - Friday) with each day showing the study sessions that occurred on that day. Each study session is where the edit and delete button will appear. Under all the days it will display the total time studied that week of all subjects, and each subjects totals as well.

Home Page: This page is where the user will first load into when entering the application. It will include a stopwatch with a modern look(circular or rounded edges for buttons), where the user will be able to interact with the stopwatch and input the data I have outlined. The functionality is as I stated above: Start, Pause, Resume, Save Entry or restart timer with a popup to ensure they want to discard current timer. Also the ability to choose/fill in the information I outlined above. Date, Time, Date_Created, and Date_Updated will all be autofilled when recording from stopwatch. Under this si where the current weeks data will live following the Weekly Format View I described above.

Weekly History Page: This will list all weeks where there are recorded study sessions. The list will show most recent to oldest. Each week will have like a rounded card or something like that, that shows the weeks dates(Ex. 10/5/2026 - 10/11/2026) the total study time of the week and totals of study time for each subject studied that week. When clicked you will expand a view or popup (whatever design choice you think is better or you can ask me to approve your thoughts) that shows the Weekly Format View and the functionality as well.

Lifetime Overview: This will be kept simple and just display the date range of oldest entry and most recent entry(not created date but date set by user since we want oldest not oldest created data entry), LifeTime total studied, and lifetime totals of time each subject studied. They should have little bar progress next to each subject and it will show a percent relative to total time. 

**NOTE**: I want to point out that we gave the ability for users to add and delete subjects from the dropdown. These should be removed from the dropdown but never actually deleted from the database to keep them for data retrieval purposes. Also some logic to add behind this. If a user deletes a subject and then creates a new one with the same name(which whenever we add to the database should be normalized in all lower caps or whatever is best practice to ensure matches) just add the old one again. If a user tries to add a new subject that already exists in the dropdown and in the database(after we normalize it and compare) just let them know it already exists.

Settings: Generic settings tab for now. Add necessary things. Also add ability to toggle darkmode on and off. Anything you might believe is worth adding please let me know and we can go over it.

#### Additional Features/Functionality:

- Auto Toggle Light and Dark Modes based on time from user. Allow them to turn off auto toggle in settings

#### Color Schemes for Light and Dark Mode

| Color Role | Light Mode | Dark Mode |
| --- | --- | --- |
| Primary Accent | #8EA58C (Sage Green – buttons, active states, progress, charts) | #8EA58C (Sage Green – consistent brand identity) |
| Background | #F7F9F6 (Soft, warm off-white) | #1A1F19 (Deep charcoal with a green tint) |
| Surface/Cards | #FFFFFF (Pure white – cards, modals, containers) | #242B22 (Slightly lighter green-gray dark tone) |
| Primary Text | #2D372A (Deep forest black – headings, important text) | #E3E8E1 (Soft, readable off-white) |
| Secondary Text | #62735E (Muted sage – captions, labels, descriptions) | #A4B3A0 (Lighter muted sage – supporting text) |
| Highlight/Timer | #D8A47F (Warm terracotta – timers, streaks, key highlights) | #E5BA9E (Soft terracotta – timers, streaks, key highlights) |

Additional design guidelines for the study tracker app:

- Primary buttons: Sage green `#8EA58C` with dark text `#2D372A` in both modes.
- Progress charts: Sage green as the primary data color.
- Focus timers: Terracotta accents to distinguish time tracking from other metrics.
- Cards: Subtle borders in dark mode to improve visual separation.
- Navigation: Sage-tinted active states, with clear text contrast.
- Overall style: Minimal, calming, and productivity-focused, avoiding excessive color or visual distractions.

#### Future Functionality to Think About(This WILL NOT be implemented yet:

- Ability to add friends and view/share data

#### Security Thoughts

Want to ensure some sort of limiting in case users try to spam the database(though data is not large in this app). Also bring up any security measure implemented or that I should.

#### Last Thoughts

Please offer any insight on design or architecture or anything regarding app functionality or clarification