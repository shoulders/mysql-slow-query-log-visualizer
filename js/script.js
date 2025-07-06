/*
MySQL Slow Query Log Visualizer
By Geoff Gaudreault (http://www.neurofuzzy.net)

Many thanks to:

List.js author Jonny Strömberg (www.jonnystromberg.se, www.listjs.com)
https://github.com/javve/list

jQuery Visualize author Scott Jehl, Filament Group scott@filamentgroup.com
https://github.com/filamentgroup/jQuery-Visualize

License (MIT)

Copyright (c) 2011 Geoff Gaudreault http://www.neurofuzzy.net
Copyright (c) 2025 Jon Brown https://quantumwarp.com/

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

//// Setup Section ////

// Processed Log Records
var logAsDataRecords = [];

// Number of Log Records
var logAsDataRecordsCount = 0;

// First and Last date of the records
var logAsDataFirstDateObj = {};
var logAsDataLastDateObj = {};
var logAsDataLastDateIndex = 0;

// Processed Log Records (filtered)
var filteredData = [];

// This will store the Table
var list;

// Actively display charts data - required for chart destruction and click handling
var displayedCharts = {};

// Working Chart Filtering Criteria - This allows for differenation between first and second click
var wcFilteringCriteria = { even: 0, start: null, end: null };

// Weekdays against ther date() reference number.
var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Aggregated Record Array
var aggregatedData = {
    'dayOfWeek': [0,0,0,0,0,0,0],
    'weekdayHours': [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Sunday
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Monday
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Tuesday
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Wednesday
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Thursday
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Friday
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // Saturday
        ],    
    'day': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // length 32 - to keep indexing correct, will be compensated for later
    'hours': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
};


/*  Just incase I need thee late
function createBlankArray(numberOfElements) {
    let blankArray = [];
    for (let i = 0; i < numberOfElements; i++) {    
        blankArray[i] = 0;        
    }
    return blankArray;
}
function createBlankArray(numberOfElements) {
    return new Array(numberOfElements).fill(0);
}
aggregatedData.weekdayHours[0] = new Array(24).fill(0);
*/



// Only start when the page is loaded
$( document ).ready(function() {
    start();
});

// Setup the Drag and Drop listeners. (for when somene drops a file into the drop_xzone)
function start() {    
    var dropZone = document.getElementById('drop_zone');
    dropZone.addEventListener('dragover', handleDragOver, false);  // maybe this can be use to convert the background or hide a select file buttong
    dropZone.addEventListener('drop', handleFileSelect, false);  // this is triggered when you drag and drop a file
}

// Configure Drag and Drop behaviour
function handleDragOver(evt) {
    evt.stopPropagation();                  // Prevents the event from bubbling up to parent elements.
    evt.preventDefault();                   // Prevents the default behavior (which is usually to not allow dropping). This tells the browser you want to allow a drop.
    evt.dataTransfer.dropEffect = 'copy';   // Changes the cursor to indicate that a copy will be made if the item is dropped. This visually signals to the user that copying the dragged data (not moving or linking it) is the intended action.
}

// Upload the file and pass log to processing (Main function)
function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    // files is a FileList of File objects. List some properties.
    var files = evt.dataTransfer.files;    
    var f = files[0];

    // Update Onscreen - Show uploaded file information
    $('#log_information_file').html(f.name + ' (' + f.size + ' bytes)');

    // Variable to hold the file object
    var reader = new FileReader();

    // Closure to capture the file.    
    reader.onloadend = function(e) {

        // When the file has been uploaded
        if (e.target.readyState === FileReader.DONE) {

            // Process the log and return number of records
            try {
                processLog(e.target.result);                
            } catch (error) {
                console.log(error);
            }

            // Update Onscreen - Show processing is complete               
            $('#information').prop('hidden', true);   
            $('#log_information').prop('hidden', false);
            $('#log_information_logAsDataRecordsCount').html(logAsDataRecordsCount);       
            $('#log_information_startDate').html(logAsDataRecords[0].date);  
            $('#log_information_endDate').html(logAsDataRecords[logAsDataLastDateIndex].date);
            logAsDataRecordsCount ? $('#no-records').prop('hidden', true) : $('#no-records').prop('hidden', false);

            // Change screen from file dropbox, create and display the table         
            try {
                createList();
            } catch (error) {
                console.log(error);
            }

            // Create and display the Chart
            try {
                buildGlobalChart();
            } catch (error) {
                console.log(error);
            }

        }
    };

    // Intiate the file upload as text
    reader.readAsText(f);

    // Empty the File Blob
    f = undefined;

}


//// Processing Log Section ////


// Process the uploaded slow query log, parseout the records
function processLog(logFileTextBlob) {
    var log_entry;
    var log_entry_lines;    
    var query_request_stats;     

    // Split by timegroup to allow for correct local time string
    var logAsTimeGroups = logFileTextBlob.split(/(?=# Time: )/);

    // Check if the first record is a log header
    if(logAsTimeGroups[0].search(/Version:/)) {

        // Update Onscreen - Server information
        var serverDetails = logAsTimeGroups[0].match(/(.*), Version: (.*) \((.*)\)/);
        $('#server_details').html(serverDetails[3] + ' (' + serverDetails[2] + ')') 

        // Remove this record
        logAsTimeGroups.shift();
    }

    // Intialise the `i` variable here to maintain record numbering over timegroups
    var i = 0;

    // Cycle through the records grouped by time (eg: # Time: 250417  2:20:32)
    for (var t = 0; t < logAsTimeGroups.length; t++) {

        // Grab the TimeGroup's `# Time:` statement
        var local_time = logAsTimeGroups[t].match(/# Time: (.*)\n/)[1];

        // Remove the `# Time:` from this record
        logAsTimeGroups[t] = logAsTimeGroups[t].replace(/# Time: .*\n/, '');

        // Generate an ISO 8601 format date from `# Time:` statement (YYYY-MM-DDTHH:mm:ss.sssZ)
        var date_iso = local_time.match(/([0-9]{2})([0-9]{2})([0-9]{2})[ ]{1,2}([0-9]{1,2}):([0-9]{2}):([0-9]{2})/);        
        date_iso = '20' + date_iso[1] + '-' + date_iso[2] + '-' + date_iso[3] + 'T' + _.padStart(date_iso[4], 2, '0') + ':' + date_iso[5] + ':' + date_iso[6] + '.000Z';

        // Create Date Object (UTC time)
        // JavaScript's Date object does not support timezones.
        // It always converts the input (date or timestamp) to UTC (Zulu) time internally.               
        // How it interprets the input depends on whether a time zone is included in the string.
        // Adding Z (Zulu/UTC timezone) on the end of the string, date() interprets the dates as UTC time, dropping the Z it interprets dates as local time
        // When the time zone offset is absent, date-only forms are interpreted as a UTC time and date-time forms are interpreted as a local time.
        // d = new Date(logAsDataRecords[i].timestamp * 1000); // 1000 milliseconds = 1 second
        var d = new Date(date_iso);

        // Extract parts of the date     
        var year = d.getUTCFullYear();        
        var month = (d.getUTCMonth() + 1);  // 0 - 11
        var day = d.getUTCDate();           // 1 - 31
        var hours = d.getUTCHours();        // 0 - 23
        var mins = d.getUTCMinutes();       // 0 - 29
        var secs = d.getUTCSeconds();       // 0 - 59
        var dayOfWeek = d.getUTCDay();      // 0 - 6  (Sunday --> Saturday)

        // String used for display (YYYY-MM-DDTHH:mm:ss)
        var dateString = d.toISOString().replace('T', ' ').replace(/\..*$/, '');        
   
        // Split the time text groups into records into an array by splitting at "# User@Host: "
        var logAsTextRecords = logAsTimeGroups[t].split(/(?=# User@Host: )/);

        // Cycle through the extracted text records array and process them in to usable records in a new array
        for (var r = 0; r < logAsTextRecords.length; r++) {

            // Intialise the variable
            logAsDataRecords[i] = [];

            // Load text record for processing        
            log_entry = logAsTextRecords[r];

            // Split the record into separate lines for easier processing
            log_entry_lines = log_entry.split("\n");
            
            // Add Local Time
            logAsDataRecords[i].time = local_time;

            // Add User, DB, Host            
            var thecredentials = log_entry_lines[0].match(/# User@Host: (.*)\[(.*)\] @ (.*) \[\]/);
            logAsDataRecords[i].user = thecredentials[1];
            logAsDataRecords[i].db_name = thecredentials[2];
            logAsDataRecords[i].host = thecredentials[3];

            // Add Thread_id/Schema/QC
            var theprocess = log_entry_lines[1].match(/# Thread_id: (.*)  Schema: (.*)  QC_hit: (.*)/);
            logAsDataRecords[i].thread_id = theprocess[1];
            logAsDataRecords[i].schema = theprocess[2];
            logAsDataRecords[i].qc_hit = theprocess[3];

            // Add Query Stats (Request)
            var query_request_stats = log_entry_lines[2].split(" ");
            logAsDataRecords[i].query_duration = query_request_stats[2].trim();
            logAsDataRecords[i].lock_duration = query_request_stats[5].trim();
            logAsDataRecords[i].rows_sent = query_request_stats[8].trim();
            logAsDataRecords[i].rows_examined = query_request_stats[11].trim();

            // Add Query Stats (Result) Stats rows_Affected/Bytes_sent
            var query_result_stats = log_entry_lines[3].split(" ");
            logAsDataRecords[i].rows_affected = query_result_stats[2].trim();
            logAsDataRecords[i].bytes_sent = query_result_stats[5].trim();

            // `use` Statement - Not all queries have this line, remove if found.
            if (log_entry_lines[4].substr(0,3) === "use") {
                log_entry_lines.shift(); 
            }

            // Timestamp (converted to Javascript syntax with milliseconds)
            logAsDataRecords[i].timestamp = log_entry_lines[4].match(/SET timestamp=(.*);/)[1]  + '000';

            // Add Query String
            logAsDataRecords[i].query_string = log_entry_lines[5];


            //// All data has been extracted from the log - Process as required ////


            // Add Query String stripped of the `WHERE` clauses
            logAsDataRecords[i].query_with_stripped_where_clauses = stripWhereClauses(logAsDataRecords[i].query_string);

            // Transform some values into buttons
            var hideShowButtons = '<button class="showBtn" onclick="showQuery(this);">Show</button> <button class="hideBtn" onclick="hideQuery(this);" style="display:none">Hide</button> <button class="copyToClipboardBtn">Copy</button>';
            logAsDataRecords[i].query_string = hideShowButtons + '<span style="display:none"><br/>' + logAsDataRecords[i].query_string + '</span>';
            if(logAsDataRecords[i].query_with_stripped_where_clauses) {                       
                logAsDataRecords[i].query_with_stripped_where_clauses = hideShowButtons + '<span style="display:none"><br/>' + logAsDataRecords[i].query_with_stripped_where_clauses+'</span>';
            }   

            // Add Date information            
            logAsDataRecords[i].dateObj = d;
            logAsDataRecords[i].date = dateString;
            logAsDataRecords[i].dayName = dayNames[dayOfWeek];  // This will allow searching by day name in the table


            //// Record Aggregation Section ////

            
            // Weekdays Aggregated record count (Sunday - Saturday)            
            aggregatedData.dayOfWeek[dayOfWeek]++; 

            // Weekdays (by hour) Aggregated record count (Sunday - Saturday)           
            aggregatedData.weekdayHours[dayOfWeek][hours]++;
            
            // Days Aggregated record count (1 - 31) (NB: thre is a zero index in the array)
            aggregatedData.day[day]++; 

            // count of all records in this hour
            aggregatedData.hours[hours]++;              

            // Advance Records reference by one
            i++;

        }

    }

    // Empty the uneeded variables to reduce RAM usage - also could use = null; can never unset a varible in JS
    logFileTextBlob = undefined;
    logAsTimeGroups = undefined;
    logAsTextRecords = undefined;    


    //// The Log has been looped and all records extracted ////


    // Count and Add all the occurances of a record's Query Pattern (WHERE clause removed) (Global and Filtered) to it's record
    calculateQueryPatternOccurencesTextOn(logAsDataRecords, 'both');

    // Get the number of records
    logAsDataRecordsCount = logAsDataRecords.length;

    // Get date range of the records (assumes records in order = quick)
    logAsDataFirstDateObj = logAsDataRecords[0].dateObj;
    logAsDataLastDateIndex = logAsDataRecordsCount - 1;
    logAsDataLastDateObj = logAsDataRecords[logAsDataLastDateIndex].dateObj;

    /* Get date range of the records (checks every record = slow)
    logAsDataFirstDateObj = _.minBy(logAsDataRecords, 'dateObj').dateObj;
    logAsDataLastDateObj = _.maxBy(logAsDataRecords, 'dateObj').dateObj;*/
    
    // Finished building log, 
    return;

}

// Strips any WHERE clauses and replaces them with a ?
function stripWhereClauses(query) {

    var indexOfWhere = query.toUpperCase().lastIndexOf("WHERE");

    // If no WHERE clause, return nothing
    if(indexOfWhere === -1) {return ''}

    var initialRadical = query.substr(0, indexOfWhere);

    var chunkToReplace = query.substr(indexOfWhere);

    // First, stripping slashes / carriage returns
    chunkToReplace = chunkToReplace.replace(/[\r\n\s]+/gim, " ");

    // Replacing operators
    chunkToReplace = chunkToReplace.replace(/is null/gim, "IS ?"); // IS NULL => IS ?
    chunkToReplace = chunkToReplace.replace(/is not null/gim, "IS ?"); // IS NOT NULL => IS ?
    chunkToReplace = chunkToReplace.replace(/in\s?\([^)]*\)+/gim, "IN ?"); // IN (...) => IN ?
    chunkToReplace = chunkToReplace.replace(/([^><])=\s?(?:'[^']*'|"[^"]*"|[^\s]+)/gim, '$1= ?'); // xxx = ... => xxx = ?
    chunkToReplace = chunkToReplace.replace(/>(=)?\s?(?:'[^']*'|"[^"]*"|[^\s]+)/gim, ">$1 ?"); // xxx > ... => xxx > ? and xxx >= ... => xxx >= ?
    chunkToReplace = chunkToReplace.replace(/<(=)?\s?(?:'[^']*'|"[^"]*"|[^\s]+)/gim, "<$1 ?"); // xxx < ... => xxx > ? and xxx <= ... => xxx >= ?
    chunkToReplace = chunkToReplace.replace(/between\s(?:'[^']*'|"[^"]*"|[^\s]+)\sand\s(?:'[^']*'|"[^"]*"|[^\s]+)/gim, "BETWEEN ? AND ?"); // BETWEEN ... AND ... => BETWEEN ? AND ?
    chunkToReplace = chunkToReplace.replace(/find_in_set\(\s*(?:'[^']*'|"[^"]*"|[^\s]+)/gim, "FIND_IN_SET(?"); // FIND_IN_SET(...) => FIND_IN_SET(?)

    // Return stripped WHERE clause
    return initialRadical + chunkToReplace;
}

// Count and Add all occurances of a record's Query Pattern (WHERE clause removed), for all records
function calculateQueryPatternOccurencesTextOn(dataItems, target) {

    // Group by `Stripped WHERE clause`. The returned data includes a count of each group's members
    var dataGroupedByStrippedQueries = _.groupBy(dataItems, 'query_with_stripped_where_clauses');

    // Add the number of occurances of a record's SQL Query with the `WHERE` clause removed.
    // This takes a record's query and matches it against a group from above, then gets that group's count, then adds that number into the record's data.
    // This is one for each record.
    _.each(dataItems, function(data) {
        if(target === 'global' || target === 'both') {data.query_pattern_global_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;}        
        if(target === 'filtered' || target === 'both') {data.query_pattern_filtered_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;}        
    });
}


//// Table Section ////


// Create the table, hide `file drop` area and enable the `data table`
function createList()
{
    // Delay used in debounced functions
    let debounceDelay = 1000;

    // Get the item template from the DOM, and then correct the placeholder - This avoids an unwanted empty record.
    let listItemTemplate = '<tr>' + $('#log_list_item').html() + '</tr>';
    $('#log_list_item').remove();

    // Enable the list
    var options = {
        item: listItemTemplate,
        searchDelay: debounceDelay,                     // Delay search/filter by XXXms, after user stops typing
        valueNames: Object.keys(logAsDataRecords[0]),   // list.js now need a list of data fields
        page: 2,                                       // This per page so pagination is off, Limits visible items
        pagination: [{                                  // If you do not have the relevant HTML inside the list container then you will get errors
            paginationClass: 'paginationTop',           // The default class is 'pagination',
            innerWindow: 2,
            outerWindow: 2,
            }, {
            paginationClass: 'paginationBottom',
            innerWindow: 2,
            outerWindow: 2,
        }]
    };    
    list = new List('log_list', options, logAsDataRecords);


    // This fires after pagination, search, or filtering.#
    // Specifically, after List.js finishes updating its internal data, but not necessarily after the browser has finished rendering the DOM.
    list.on('updated', function () {

        // Wait until the next paint cycle
        requestAnimationFrame(function () {

            // Update Onscreen - Number of list records
            displayListItemsCounts();

            // Update Onscreen - Prev and Next buttons
            prevNextButtons();

        })
    });

    // Update Onscreen - Number of list records
    displayListItemsCounts();

    // Update Onscreen - Prev and Next buttons
    prevNextButtons();

    // This enables the copy to clipboard buttons
    new ClipboardJS('.copyToClipboardBtn', {
        text: function(trigger){
            return trigger.nextElementSibling.innerText;
        }
    });

    // When input in the filter box, update the item counts (has a delay to prevent over searching) (not currently used/needed keep for reference in using debounce)
    //$('#log_list_search').keyup(debounce(displayListItemsCounts, debounceDelay));

    // Change display options
    $('#drop_zone').prop('hidden', true);           // hide the file drag and drop box
    $('#log_list_container').prop('hidden', false); // unhide the table section
    $('#log_list').css('display','table');          // unhide the data table
  
}

// Update Onscreen - Number of records
function displayListItemsCounts(){    
    list.matchingItems.length ? $('#no-records').prop('hidden', true) : $('#no-records').prop('hidden', false);
    $('#list_items_count_filtered').html(list.matchingItems.length);
    $('#list_items_count_visible').html(list.visibleItems.length);
    $('#list_items_count_total').html(list.items.length);
    $('#list_items_count_showing').html(list.visibleItems.length);
    $('#list_items_count_showingOf').html(list.matchingItems.length);
}

// Prev/Next Button Handling
function prevNextButtons(){

    // Current page number (both of these work)
    let currentPage = Math.ceil(list.i / list.page);
    //let currentPage = +$('ul.pagination li.active a.page').attr('data-i');

    // Last page number
    let totalPages = Math.ceil(list.matchingItems.length / list.page);

    // Make the Prev and Next buttons disabled on first and last pages accordingl
    // First Page
    if (currentPage == 1) {
        $(".pagination-prev").prop('hidden', true);
        $(".pagination-next").prop('hidden', false);
    }
    // Last Page
    else if (currentPage == totalPages) {
        $(".pagination-prev").prop('hidden', false);
        $(".pagination-next").prop('hidden', true);
    }
    // Middle Page(s)
    else { 
        $(".pagination-prev").prop('hidden', false);
        $(".pagination-next").prop('hidden', false);
    }

    // Hide pagination if there one or less pages to show
    if (list.matchingItems.length <= list.page) { 
        $(".pagination-container").hide();
    } else {
        $(".pagination-container").show();
    }

    // Disable link on active page number
    $('ul.pagination a.page').attr('href', '#').css('cursor', '');
    $('ul.pagination li.active a.page').removeAttr('href').off('click').css('cursor', 'default');

    // Add Click event to the Prev and Next buttons
    $('.pagination-prev').attr('data-i', currentPage - 1).attr('data-page', list.page);
    $('.pagination-next').attr('data-i', currentPage + 1).attr('data-page', list.page);

}

// (Not currently used)
// Debounce function - Prevents access a function until no input for a number of milliseconds.
// Only the last function will execute, they are not all delayed and stacked for execution.
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId); // Clear previous timeout
    timeoutId = setTimeout(() => {
      func.apply(this, args); // Call the function with the latest args
    }, delay);
  };
}

/* Updates number of result shown in filtered list (works but I dont use it)
function updateListAfterFilterBoxChange() {

    // Search all List Items (records) anf if a match is found in any column, count the record once
    var count = 0;    
    var listLength = list.items.length;
    for (var i = 0;  i < listLength; i++) {    
        if (
            (list.filtered && list.searched && list.items[i].found && list.items[i].filtered) ||
            (list.filtered && !list.searched && list.items[i].filtered) ||
            (!list.filtered && list.searched && list.items[i].found) ||
            (!list.filtered && !list.searched)
        )
        {      
            // Increment the filtered records counter  
            count++;
        }
    }

    // Update Onscreen - number of results
    $("#search_count").text(count + " results ");
}*/


//// Creating Sections ////


// Create the GLOBAL chart (using logAsDataRecords as source data)
function buildGlobalChart()
{
    // When `Group By :` dropdown is changed, reload the graph
    $('#global_time_scale').on('change', function(){
        buildGlobalChart();
    });
    
    // Create Chart the correct for the 'Group By' (Drop Down) data type selection
    switch ($('#global_time_scale').val()) {
        case 'aggregatedWeekdays':
            createAggregatedWeekdaysChart(
                logAsDataRecords,
                'globalChart',
                $('#globalChart'),                            
                $('#global_chart_queries_count')               
            );
            break;
        case 'aggregatedWeekdayHours':
            createAggregatedWeekdayHoursChart(
                logAsDataRecords,
                'globalChart',
                $('#globalChart'),                            
                $('#global_chart_queries_count')               
            );
            break;
        case 'aggregatedDays':
            createAggregatedDaysChart(
                logAsDataRecords,
                'globalChart',
                $('#globalChart'),                            
                $('#global_chart_queries_count')               
            );
            break;
        case 'aggregatedHours':
            createAggregatedHoursChart(
                logAsDataRecords,
                'globalChart',
                $('#globalChart'),                            
                $('#global_chart_queries_count')               
            );
            break;
        default:      
            createStandardChart(
                logAsDataRecords,
                logAsDataFirstDateObj,
                logAsDataLastDateObj,
                'globalChart',
                $('#globalChart'),
                $('#global_time_scale'),                
                $('#global_chart_queries_count')           
            );            
    }

};

// Create WORKING chart (with filtered data) (from a click event)
function buildWorkingChart(evt = null, firstDate = null, lastDate = null, chartIdentifier = null){

    // When `Group By :` dropdown is changed, reload the graph
    $('#working_time_scale').on('change', function(){
        buildWorkingChart();
    });

    // If this function has been called by a click event
    if(evt) {


        //// Get Data from Global Chart (via the click event) ////


        // `getElementsAtEventForMode` is a Chart.js method to find data points on the chart that are nearest to the event evt (e.g. a mouse click or hover).
        var activePoints = displayedCharts[chartIdentifier].chartObj.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);

        // This picks the middle point from the array of active (nearest) points.
        var medianPoint = activePoints[Math.floor(activePoints.length/2)];

        // If no median point is found, exit chart creation
        if(!medianPoint) { return; }  

        // Get the median index, which we will use for the source segment's index
        var index = medianPoint.index;

        // Get the source segment's object/array from the chart object.
        var sourceTimeScaleSegment = displayedCharts[chartIdentifier].timeScaleSegments[index];


        //// Filter Data ////

        
        // Determine whether it's the "start date" (first click) or the "end date" (second click).
        wcFilteringCriteria.even = (wcFilteringCriteria.even + 1) % 2;

        // On the first click, set the start of the date range (working chart)
        if(wcFilteringCriteria.even === 1){

            // Set start of filtering range
            wcFilteringCriteria.start = sourceTimeScaleSegment;

            // Update Onscreen - The end date below the working chart (YYYY-MM-DDTHH:mm:ss)
            $('#filterStart').text(wcFilteringCriteria.start.startingDate.toISOString().replace('T', ' ').replace(/\..*$/, '')); 
            $('#filterEnd').text(''); 
        
        // On the second click, set the end of the date range (working chart)
        } else {

            // If the start date is greater than the end date, set end to be the same as start (same as double clickling)
            if(wcFilteringCriteria.start.startingDate > sourceTimeScaleSegment.startingDate) { wcFilteringCriteria.end = wcFilteringCriteria.start }

            // Set end of filtering range (normally)
            else { wcFilteringCriteria.end = sourceTimeScaleSegment;}

            // Update Onscreen - The end date below the working chart (YYYY-MM-DDTHH:mm:ss)
            $('#filterEnd').text(wcFilteringCriteria.end.endingDate.toISOString().replace('T', ' ').replace(/\..*$/, ''));  
        }

        // Filter the data by specified criteria (start or end segment date), if not, just copy logAsDataRecords into filteredData
        filteredData = (wcFilteringCriteria.start || wcFilteringCriteria.end) ?

            // Return a new array with records that are within the specified criteria
            _.filter(logAsDataRecords, function(item){
                if(wcFilteringCriteria.start && !wcFilteringCriteria.start.matchesWithLowBound(item.dateObj)) {
                    return false;
                }
                if(wcFilteringCriteria.end && !wcFilteringCriteria.end.matchesWithHighBound(item.dateObj)) {
                    return false;
                }
                return true;
            })

        : logAsDataRecords;

        // Update the Query Pattern (WHERE clause removed) occurances for filtered records
        calculateQueryPatternOccurencesTextOn(filteredData, 'filtered');


        //// Update the filtered Data in the table  ////


        // Clear and Update the table/list with the filtered records
        list.clear();   
        list.add(filteredData);
        displayListItemsCounts();

    }

    // Create/update the working chart with the filtered data
    createStandardChart(
        filteredData,
        wcFilteringCriteria.start ? wcFilteringCriteria.start.startingDate : firstDate,
        wcFilteringCriteria.end ? wcFilteringCriteria.end.endingDate : lastDate,
        'workingChart',        
        $('#workingChart'),
        $('#working_time_scale'),        
        $('#working_chart_queries_count')
    );

    // Update Onscreen - Show the chart
    $('#working_chart_container').prop('hidden', false);
}

// Create a Standard Chart
function createStandardChart(
    data,
    firstDate,
    lastDate,
    chartIdentifier,
    $chartCanvas,
    $timeScaleSelector,    
    $queryCountContainer    
)
{   
    // Return X-AXIS time segment specifications (Length in milliseconds / Label Format via a function)
    //   _.padStart() = is adding in a "0" when minute/hour/day/week only has 1 character    
    //   numberOfMillis = number of millieseconds in this segment type
    //   format = A stored function that returns a date text string, from the supplied date, for this segment type. Is used for labels on the X_AXIS.
    var timeScaleSpecification = {

        month: {//YYYY-MM-DDTHH:mm:ss.sssZ
            numberOfMillis: 1000*60*60*24*7*4,   // 4 Weeks / 28 Days
            //format: function(date){ return _.padStart(date.getUTCDate(), 2, "0") + "/" + _.padStart(date.getUTCMonth() + 1, 2, "0"); }            
            format: function(date){ return date.toISOString().replace('T', ' ').replace(/-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/, ''); } // (YYYY-MM)
        },
        week: {
            numberOfMillis: 1000*60*60*24*7,
            //format: function(date){ return _.padStart(date.getUTCDate(), 2, "0") + "/" + _.padStart(date.getUTCMonth() + 1, 2, "0"); }
            format: function(date){ return date.toISOString().replace('T', ' ').replace(/ [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/, ''); } // (YYYY-MM-DD)
        },        
        day: {
            numberOfMillis: 1000*60*60*24,
            //format: function(date){ return _.padStart(date.getUTCDate(), 2, "0") + "/" + _.padStart(date.getUTCMonth() + 1, 2, "0"); }
            format: function(date){ return date.toISOString().replace('T', ' ').replace(/ [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/, ''); } // (YYYY-MM-DD)
        },
        hour: {
            numberOfMillis: 1000*60*60,
            //format: function(date){ return _.padStart(date.getUTCDate(), 2, "0") + "/" + _.padStart(date.getUTCMonth() + 1, 2, "0") + " " + _.padStart(date.getUTCHours(), 2, "0") + "h"; }
            format: function(date){ return date.toISOString().replace('T', ' ').replace(/[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/, '') + '00'; } // (YYYY-MM-DD HH)
        },
        minute: {
            numberOfMillis: 1000*60,
            //format: function(date) {return _.padStart(date.getUTCDate(), 2, "0") + "/" + _.padStart(date.getUTCMonth() + 1, 2, "0") + " " + _.padStart(date.getUTCHours(), 2, "0") + ":"+ _.padStart(date.getUTCMinutes(), 2, "0");}
            format: function(date){ return date.toISOString().replace('T', ' ').replace(/[0-9]{2}\.[0-9]{3}Z$/, '') + '00'; } // (YYYY-MM-DDTHH:mm)
        },
    };

    // Sets the segment type based on the users dropdown selection
    var currentTimeScale = timeScaleSpecification[$timeScaleSelector.val()];
    
    // X-AXIS Segements - Create an array which holds all of the calculated time segements, their start time, end time, X-AXIS label and test functions
    var timeScaleSegments = _(

        // This `_.range()` section, converts a start and end date into their timestamps, then divides them by the selected segment's length in milliseconds (timestamp).
        //      These new values are the segment number as calculated from the epoch.
        //      These start and end segment numbers are now put into the _.range() function to get the range of segment numbers from the given start value up to, but not including the end value.
        //      Returned as an array with only integers as values.
        //      Example  [] = [20194, 20195, 20196]
        // .range()
        //      Creates an array of numbers (positive and/or negative) progressing from start up to, but not including the last integer.
        //      from lodash
        _.range(

            // Math.Floor()
            //      Round result down to nearest integer
            // math.floor() is needed because:
            //      The number of milliseconds might not exactly match the number of millieseconds in a segment size leading to decimals.
            //      The number of milliseconds might not exactly intersect the boundry of a segment leading to decimals.
            //      Ensures we use the timestamp at the start of the segement leading to correctly addressing the segements at their start point.
            Math.floor((firstDate.getTime())/(currentTimeScale.numberOfMillis)),
            
            // math.floor() is not needed because: the beginning of the segment is always included and _.range() only returns integers
            (lastDate.getTime())/(currentTimeScale.numberOfMillis)

        ))

        // This takes the range array from above [20194, 20195, 20196], runs all of the values them all through the function specified, and creates a new array.
        // .map()
        //      creates a new array, of this data 
        //      (index, itemsIndex, items) are special variables    
        .map(                        
            function(index, itemsIndex, items){

                // Convert this segement's number back into timestamp and then a date object
                var startingDate = new Date(index * currentTimeScale.numberOfMillis);

                // Add the next segment's number as this segements end. (same logic as above)
                var endingDate = new Date((index + 1) * currentTimeScale.numberOfMillis);

                // This is a time segement object
                return {

                    // Segement Values
                    startingDate: new Date(index * currentTimeScale.numberOfMillis),        // Date Object - Segment start time
                    endingDate: new Date((index + 1) * currentTimeScale.numberOfMillis),    // Date Object - Next segment start time
                    labels: currentTimeScale.format(startingDate),                          // Get the date formmatted correctly for this segment type                            
                    
                    // Segment Test functions - used to check against dates to discover if they belong in this segement etc...
                    matchesWithLowBound: function(date) { return date.getTime() >= startingDate.getTime(); },                   // Returns function: Returns Boolean, getTime() returns timestamps, is the supplied date after (or including) the segement's starting time
                    matchesWithHighBound: function(date) { return date.getTime() < endingDate.getTime(); },                     // Returns function: Returns Boolean, getTime() returns timestamps, is the supplied date before the segements' end time
                    matchesWith: function(date) { return this.matchesWithLowBound(date) && this.matchesWithHighBound(date); }   // Is the supplied date within this segments time range

                };
            }
        )

        // Returns the .map() array  ([0],[1],[2],[3],[4],[5],.....)
        .value();

    // Group records by time segment: copy`data` into new array, add segment index to records, then group records by index (timeScaleRange) (returns object)
    let recordsGroupedByTimeSegment = 

        // Loop through all `data` records running the function() on each of them. (Returns a new array)
        _(data).map(function(data){

            // Adds `timeScaleIndex` key/value (created below) to the current `data` record
            return _.extend({}, data, {

                    // Find the X-AXIS time segment the current `data` record belongs to.
                    // Loop through `timeScaleSegments` (X-AXIS time segments), testing with the function() to see if the current `data` record's date is within that segment.
                    // When the first match is found, _.findIndex() will return the array index value (segment number)
                    timeScaleIndex: _.findIndex(timeScaleSegments, function(index, itemsIndex, items){ 
                        
                        // Is the current `data` record's date within this time segment
                        return index.matchesWith(data.dateObj);
                    })

                }
            );

        })
    
        // This groups by 'timeScaleIndex'
        .groupBy('timeScaleIndex')

        // Return the value (object)
        .value();

    // Build an array of record counts against time segment (only segments with records will get a key/pair value, i.e. some indexes will be missing)
    var recordCountsAgainstTimeScaleIndex = _(recordsGroupedByTimeSegment).mapValues('length').value();
    
    // Build an array of record counts against all time segments - Using `timeScaleSegments` as an index, create a new array, mapping the record counts against time segment.
    var chartDatasetData = _(timeScaleSegments).map(function(timeScaleRange, timeScaleIndex){ return recordCountsAgainstTimeScaleIndex[timeScaleIndex] || 0; }).value();

    // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$('#globalChart')`  ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it using the dynamically created chart identifier (chart.js)
    if(displayedCharts[chartIdentifier]){ displayedCharts[chartIdentifier].chartObj.destroy(); }
    
    // Instanciate Chart Class
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: _.map(timeScaleSegments, 'labels'),
            datasets: [{
                label: "Number of Queries",
                fillColor: "rgba(220,220,220,0.2)",
                strokeColor: "hsl(0, 0.00%, 86.30%)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                barPercentage: 0.95,                     // Spacing between bars
                categoryPercentage: 0.95,                // Spacing between categories
                data: chartDatasetData,
            }]
        },
        options: {
            pointHitDetectionRadius: 1,
            scales: {

                // X- AXIS configuration
                x: {
                    title: {
                        display: true,
                        text: 'Time of Request'         // Label for the x-axis
                    },
                    ticks: {
                        //stepSize: 1,                  // Customize tick intervals
                        //color: 'blue',                // Change tick color
                        autoSkip: true,                 // Automatically calculates how many labels can be shown. This also hides the last label (or skipped from callback)
                                                        // https://github.com/chartjs/Chart.js/issues/6154 - Chartjs v2.8 removes latest label on line chart 
                                                        // https://github.com/chartjs/Chart.js/pull/5891 - Remove autoSkip logic to always display last tick
                        callback: function(value, index, ticks) {

                            // Maximum number of labels to be displayed on the X-AXIS   
                            let maxDisplayedLabels = 15;                           

                            // Show X-AXIS labels, display logic
                            return (
                                
                                // If the total number of items (time segments) is less than or equal to the label limit (maxDisplayedLabels), then show all labels.
                                ticks.length <= maxDisplayedLabels ||

                                // Always show the first label (might not be needed)
                                index === 0 ||                          

                                // Always show the last label (requires `autoSkip: false`)
                                //index === (ticks.length - 1) ||
                                
                                // If the total number of items (time segments) is more than the label limit (maxDisplayedLabels), this line distributes the labels evenly (upto the max number of labels)
                                //  Math.round(items.length / maxDisplayedLabels): Determines a "step size" — how often to display a label.
                                //  index % stepSize === 0: Only display labels at these regular intervals.
                                index % (Math.round(ticks.length / maxDisplayedLabels)) === 0

                            ) ? this.getLabelForValue(value) : '';

                            // Show only every 2nd label (alterantive method)
                            //return index % 2 === 0 ? this.getLabelForValue(value) : '';

                        }
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                },
                // Y-AXIS configuration
                y: {
                    beginAtZero: true,                      // Start the axis at zero
                    title: {
                        display: true,
                        text: 'Requests'                    // Label for the y-axis
                    },
                    ticks: {
                        stepSize: 1,                        // Ensure integers
                        //color: 'blue'                     // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                }
            }
        }
    });

    // Store the Chart object - Needed for chart destruction and click handling
    displayedCharts[chartIdentifier] = {
        chartObj: chart,
        timeScaleSegments: timeScaleSegments
    }    

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Creates click event on the chart - creates/updates the working chart
    $chartCanvas.on('click', function(evt) { buildWorkingChart(evt, firstDate, lastDate, chartIdentifier); });

    // Display/Hide sections as needed    
    $('#global_chart_container').prop('hidden', false);    
    $('#log_list_container').prop('hidden', false);

}

// Create Aggregated Weekdays Chart
function createAggregatedWeekdaysChart(
    data,
    chartIdentifier,
    $chartCanvas,  
    $queryCountContainer    
)
{
    // Build an array of time segments (Weekday, Mon-Sun) with, a count of records per time segment
    var timeScaleSegments = convertSunSatToMonSun(aggregatedData.dayOfWeek);

    // Build the chart's dataset (records per segment in an array)  TODO: should i get rid of this variable and put it straight into the datasert
    var chartDatasetData = timeScaleSegments;

     // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$('#globalChart')`  ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it
    if(displayedCharts[chartIdentifier]){ displayedCharts[chartIdentifier].chartObj.destroy(); }

        // Instanciate Chart Class
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            datasets: [{
                label: "Number of Queries",
                fillColor: "rgba(220,220,220,0.2)",
                strokeColor: "hsl(0, 0.00%, 86.30%)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                barPercentage: 0.95,                     // Spacing between bars
                categoryPercentage: 0.95,                // Spacing between categories
                data: chartDatasetData,
            }]
        },
        options: {
            pointHitDetectionRadius: 1,
            scales: {

                // X- AXIS configuration
                x: {
                    title: {
                        display: true,
                        text: 'Day of Request'         // Label for the x-axis
                    },
                    ticks: {
                        //stepSize: 1,                  // Customize tick intervals
                        //color: 'blue',                // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                },
                // Y-AXIS configuration
                y: {
                    beginAtZero: true,                      // Start the axis at zero
                    title: {
                        display: true,
                        text: 'Requests'                    // Label for the y-axis
                    },
                    ticks: {
                        stepSize: 1,                        // Ensure integers
                        //color: 'blue'                     // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                }
            }
        }
    });

    // Store the Chart object - Needed for chart destruction and click handling
    displayedCharts[chartIdentifier] = {
        chartObj: chart,
        timeScaleSegments: timeScaleSegments
    } 

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Display/Hide sections as needed
    $('#global_chart_container').prop('hidden', false);
    $('#working_chart_container').prop('hidden', true);
    $('#log_list_container').prop('hidden', true);

};

// Create Aggregated Weekday Hours Chart - This will be aline graph with multiple datyasets
function createAggregatedWeekdayHoursChart(
    data,
    chartIdentifier,
    $chartCanvas,  
    $queryCountContainer    
)
{
    //TODO: should i keep the data split like this or inject straight into the dataset. + tidy up the 2 comments blow so they make sense to keep them

    // Build an array of time segments (Day) with, a count of records per time segment - first element not used so is removed.
    var timeScaleSegments = aggregatedData.hours;

    // Build the chart's dataset (records per segment in an array)
    let chartDatasetData = {};
    chartDatasetData.monday = convertSunSatToMonSun(aggregatedData.weekdayHours[1]);
    chartDatasetData.tuesday = convertSunSatToMonSun(aggregatedData.weekdayHours[2]);
    chartDatasetData.wednesday = convertSunSatToMonSun(aggregatedData.weekdayHours[3]);
    chartDatasetData.thursday = convertSunSatToMonSun(aggregatedData.weekdayHours[4]);
    chartDatasetData.friday = convertSunSatToMonSun(aggregatedData.weekdayHours[5]);
    chartDatasetData.saturday = convertSunSatToMonSun(aggregatedData.weekdayHours[6]);
    chartDatasetData.sunday = convertSunSatToMonSun(aggregatedData.weekdayHours[0]);     

     // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$('#globalChart')`  ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it
    if(displayedCharts[chartIdentifier]){ displayedCharts[chartIdentifier].chartObj.destroy(); }

    // Instanciate Chart Class
    var chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'],
            datasets: [
                {
                    label: "Monday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.monday,
                },
                {
                    label: "Tuesday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.tuesday,
                },
                {
                    label: "Wednesday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.wednesday,
                },
                {
                    label: "Thursday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.thursday,
                },
                {
                    label: "Friday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.friday,
                },
                {
                    label: "Saturday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.saturday,
                },
                {
                    label: "Sunday",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "hsl(0, 0.00%, 86.30%)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    barPercentage: 0.95,                     // Spacing between bars
                    categoryPercentage: 0.95,                // Spacing between categories
                    data: chartDatasetData.sunday,
                }
        ]
        },
        options: {
            pointHitDetectionRadius: 1,
            scales: {

                // X-AXIS configuration
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Request'         // Label for the x-axis
                    },
                    ticks: {
                        //stepSize: 1,                  // Customize tick intervals
                        //color: 'blue',                // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                },
                // Y-AXIS configuration
                y: {
                    beginAtZero: true,                      // Start the axis at zero
                    title: {
                        display: true,
                        text: 'Requests'                    // Label for the y-axis
                    },
                    ticks: {
                        stepSize: 1,                        // Ensure integers
                        //color: 'blue'                     // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                }
            }
        }
    });

    // Store the Chart object - Needed for chart destruction and click handling
    displayedCharts[chartIdentifier] = {
        chartObj: chart,
        timeScaleSegments: timeScaleSegments
    } 

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Display/Hide sections as needed
    $('#global_chart_container').prop('hidden', false);
    $('#working_chart_container').prop('hidden', true);
    $('#log_list_container').prop('hidden', true);

};

// Create Aggregated Days Chart
function createAggregatedDaysChart(
    data,
    chartIdentifier,
    $chartCanvas,  
    $queryCountContainer    
)
{
    // Build an array of time segments (Day) with, a count of records per time segment - first element not used so is removed. (X-AXIS)
    var timeScaleSegments = aggregatedData.day.slice(1);

    // Build the chart's dataset (records per segment in an array)
    var chartDatasetData = timeScaleSegments;

     // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$('#globalChart')`  ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it
    if(displayedCharts[chartIdentifier]){ displayedCharts[chartIdentifier].chartObj.destroy(); }

        // Instanciate Chart Class
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31'],
            datasets: [{
                label: "Number of Queries",
                fillColor: "rgba(220,220,220,0.2)",
                strokeColor: "hsl(0, 0.00%, 86.30%)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                barPercentage: 0.95,                     // Spacing between bars
                categoryPercentage: 0.95,                // Spacing between categories
                data: chartDatasetData,
            }]
        },
        options: {
            pointHitDetectionRadius: 1,
            scales: {

                // X-AXIS configuration
                x: {
                    title: {
                        display: true,
                        text: 'Day of Request'         // Label for the x-axis
                    },
                    ticks: {
                        //stepSize: 1,                  // Customize tick intervals
                        //color: 'blue',                // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                },
                // Y-AXIS configuration
                y: {
                    beginAtZero: true,                      // Start the axis at zero
                    title: {
                        display: true,
                        text: 'Requests'                    // Label for the y-axis
                    },
                    ticks: {
                        stepSize: 1,                        // Ensure integers
                        //color: 'blue'                     // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                }
            }
        }
    });

    // Store the Chart object - Needed for chart destruction and click handling
    displayedCharts[chartIdentifier] = {
        chartObj: chart,
        timeScaleSegments: timeScaleSegments
    } 

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Display/Hide sections as needed
    $('#global_chart_container').prop('hidden', false);
    $('#working_chart_container').prop('hidden', true);
    $('#log_list_container').prop('hidden', true);

};

// Create Aggregated Hours Chart
function createAggregatedHoursChart(
    data,
    chartIdentifier,
    $chartCanvas,  
    $queryCountContainer    
)
{
    // Build an array of time segments (Day) with, a count of records per time segment - first element not used so is removed.
    var timeScaleSegments = aggregatedData.hours;

    // Build the chart's dataset (records per segment in an array)
    var chartDatasetData = timeScaleSegments;

     // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$('#globalChart')` ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it
    if(displayedCharts[chartIdentifier]){ displayedCharts[chartIdentifier].chartObj.destroy(); }

    // Instanciate Chart
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'],
            datasets: [{
                label: "Number of Queries",
                fillColor: "rgba(220,220,220,0.2)",
                strokeColor: "hsl(0, 0.00%, 86.30%)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                barPercentage: 0.95,                     // Spacing between bars
                categoryPercentage: 0.95,                // Spacing between categories
                data: chartDatasetData,
            }]
        },
        options: {
            pointHitDetectionRadius: 1,
            scales: {

                // X-AXIS configuration
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Request'         // Label for the x-axis
                    },
                    ticks: {
                        //stepSize: 1,                  // Customize tick intervals
                        //color: 'blue',                // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                },
                // Y-AXIS configuration
                y: {
                    beginAtZero: true,                      // Start the axis at zero
                    title: {
                        display: true,
                        text: 'Requests'                    // Label for the y-axis
                    },
                    ticks: {
                        stepSize: 1,                        // Ensure integers
                        //color: 'blue'                     // Change tick color
                    },
                    /*grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                }
            }
        }
    });

    // Store the Chart object - Needed for chart destruction and click handling
    displayedCharts[chartIdentifier] = {
        chartObj: chart,
        timeScaleSegments: timeScaleSegments
    } 

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Display/Hide sections as needed
    $('#global_chart_container').prop('hidden', false);
    $('#working_chart_container').prop('hidden', true);
    $('#log_list_container').prop('hidden', true);

};


// Convert a day array from (Sun-Sat) to (Mon-Sun)
function convertSunSatToMonSun(dayArray){
    dayArray.push(dayArray.shift()); // Take the first array element and put it at the end
    return dayArray;
}


//// Presentation Section ////


// Reset page without having to refresh and reload log file
function resetPage() {    
    
    // Restore all records to the list  
    filteredData = null;
    list.clear();
    list.add(logAsDataRecords);
    //list.search(''); // Forces the list to re-render
    //list.update(); // Recalculates pagination if items were added/removed
    //list.show(1);  // Show first page
    
    // Update Onscreen - Reconfigure Visible assets
    $('#global_time_scale').val('hour'); 
    $('#working_time_scale').val('hour');
    $('#working_chart_container').css('display', 'none');    
    $('#log_list_container').prop('hidden', false);
    $('#filterStart').text('');
    $('#filterEnd').text('');
    logAsDataRecordsCount ? $('#no-records').prop('hidden', true) : $('#no-records').prop('hidden', false);

    // Rebuild Global Chart
    buildGlobalChart();
}

// Query Button - Show
function showQuery(node) {
    $(node).siblings('span').show();
    $(node).siblings('.hideBtn').show();
    $(node).hide();
}

// Query Button - Hide
function hideQuery(node) {
    $(node).siblings('span').hide();
    $(node).hide();
    $(node).siblings('.showBtn').show();
}
