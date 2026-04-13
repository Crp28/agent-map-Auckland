1. The user can see a map of Auckland.
2. The user can see blue pins #0056A7 on the map representing Sold Properties, and yellow #F8C00B dots on the map representing People records with coordinates.
3. The user can search for a Person or Sold Property in a top-right search bar.
4. The user can filter Sold Property pins by a date range. When no date range is entered, all Sold Properties with coordinates are shown by default.
5. The user can drag, zoom in, and zoom out on the map with mouse or keyboard.
6. The user can click on a Sold Property pin to look at its details.
7. The user can click on a Person dot to look at its details.
8. The user can filter People dots by entering a price to see if that overlaps with their purchasing power range.
9. The user can manage Sold Properties from a popup manager, including viewing, adding, editing details, and deleting records.
10. The user can manage People from a popup manager, including viewing, adding, editing details, and deleting records.
11. The user can bulk import People using a CSV file to quickly add multiple People entries in one action.
12. The user can open a retractable side list of Auckland suburb/region names, search inside it, and click one to move the map to that region at a local suburb-level zoom.

====== ACCEPTANCE CRITERIA ======
1. The map of Auckland should be fetched from Auckland Council GeoMaps (https://geomapspublic.aucklandcouncil.govt.nz/viewer/index.html), and GeoMaps boundary data is updated once every month at least.
2. Both the pins and the dots are obvious to eye, and have an optimal size that can be easily clicked but not obstructing the map too much.
3. As text is entered, results show up as a pop-up list under the search bar, each row in the list showing brief information about the item. Clicking on a result opens the modal containing detailed information about it.
4. The date range filter starts blank so all Sold Property pins with coordinates show by default. The user can modify the date range through date pickers, and the system then shows only filtered Sold Property pins on the map.
5. The map moves when holding left click and moving on mouse, and using WASD or arrow keys on keyboard. Map zooms in when scrolling up on mouse, and pressing + key on keyboard. Map zooms out when scrolling down on mouse, and pressing - key on keyboard.
6. A modal containing all information about the selected Sold Property shows up.
7. A modal containing all information about the selected Person shows up.
8. Entering a price integer shows only filtered People on the map. The People shown should either have their purchasing power range being empty or include the price entered.
9. Sold Property fields are validated before create or update. Validation errors prevent the action and show in a red line of text under the respective field.
10. People fields are validated before create or update. Email fields accept only valid email format. Last update time is updated. Validation errors prevent the action and show in a red line of text under the respective field.
11. The system accepts .csv files only. Fully redundant entries are discarded, while partially different entries are updated. Show a summary of imported and failed record numbers after processing.
12. A retractable side list shows Auckland suburb/region names from the v1 suburb catalog mapped to GeoMaps boundary data. The side list is hidden behind a handle by default, doubles the previous expanded height, includes a mini search field, and clicking a row moves the map to the corresponding region and highlights the selected row.
13. People records without latitude and longitude are saved and available in record managers, but do not render as map dots until coordinates are added or geocoded.
