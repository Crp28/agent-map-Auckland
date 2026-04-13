1. The user can see a map of Auckland showing
2. The user can see blue pins #0056A7 on map representing Sold Properties, and yellow #F8C00B dots on the map representing people.
3. The user can search for a People or Sold Property in a top-right search bar
4. The user can filter the Sold Property showing on map by a date range.
5. The user can perform drag, zoom in or zoom out with the map with mouse or keyboard.
6. The user can click on a Sold Property pin to look at its details.
7. The user can click on a People to look at its details
8. The user can filter the People showing by entering a price to see if that overlaps with their purchasing power range
9. The user can manually add a Sold Property to the database by filling a form in a popup modal.
10. The user can manually add a People to the database by filling a form in a popup modal.
11. The user can bulk import People using a CSV file to quickly add multiple People entries in one action. 
12. The user can open a retractable side list of Auckland suburb/region names and click one to move the map to that region.



======↓ACCEPTANCE CRITERIA↓======
1. The map of Auckland should be fetched from Auckland Council GeoMaps (https://geomapspublic.aucklandcouncil.govt.nz/viewer/index.html), and is updated once every month at least.
2. Both the pins and the dots are obvious to eye, and has a optimal size that can be easily clicked but not obstructing the map too much.
3. As text are entered, results shows up as a pop-up list under the search bar, each row in the list showing brief information about the item. clicking on a result opens the modal containing detailed information about it.
4. Default date range is one year before to today. The user modifies date range through date picker. the system shows only filtered Sold Property pins on map.
5. Map moves when holding left click and moving on mouse, and using WASD or arrow keys on keyboard. Map zooms in when scroll up on mouse, and pressing + key on keyboard. Map zooms out when scroll down on mouse, and pressing - key on keyboard.
6. A modal containing all information about the selected Sold Property shows up.
7. A modal containing all information about the selected People shows up.
8. Enter a price integer, the systems shows only filtered People on the map. The people showing should either have their purchasing power range being empty or include the price entered.
9. all fields are required. Any error will prevent the action and show in a red line of text under the respective field.
10. xxx fields are required. Email field accepts only valid email format. Last update time is updated. Any error will prevent the action and show in a red line of text under the respective field.
11. The system accepts .csv files only. Fully redundant entries are discarded, while partially different entries are updated. Show a summary of imported and failed records numbers after processing.
12. A retractable side list shows the Auckland suburb/region names from the GeoMaps boundary data. Clicking a row moves the map to the corresponding region and highlights the selected row.
