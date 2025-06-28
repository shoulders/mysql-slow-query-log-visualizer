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

// Processed Log Records (filtered)
var filteredData = [];

// This will store the Table
var list;

// An array to hold time related information
var timedata = [];

// Weekdays against ther date() reference number.  //TODO: sort time
var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (var i = 0; i < 7; i++) {
    timedata[i] = {};
    timedata[i].dayName = dayNames[i];
}

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

            // Update Onscreen - Show file is now being process
            $('#log_progress').html('hidden', false);           
            
            // Process the log and return number of records
            try {
                var numberOfEntries = processLog(e.target.result);                
            } catch (error) {
                console.log(error);
            }

            // Update Onscreen - Show processing is complete   
            $('#log_progress').prop('hidden', true );
            $('#information').prop('hidden', true );   
            $('#log_information').prop('hidden', false );   
            $('#log_information_entries').html(numberOfEntries);            

            // Change screen from file dropbox, create and display the table         
            try {
                createList();
            } catch (error) {
                console.log(error);
            }

            // Create and display the Chart
            try {
                createGlobalChart();
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

        // Generate an ISO 8601 format date from `# Time:` statement
        // (YYYY-MM-DDTHH:mm:ss.sssZ) 
        var date_iso = local_time.match(/([0-9]{2,4})([0-9]{2})([0-9]{2})  ([0-9]{1,2}):([0-9]{2}):([0-9]{2})/);        
        if(date_iso[4].length === 1) {date_iso[4] = '0' + date_iso[4];}   // Add missing 0 onto the hours when needed
        date_iso = '20' + date_iso[1] + '-' + date_iso[2] + '-' + date_iso[3] + 'T' + date_iso[4] + ':' + date_iso[5] + ':' + date_iso[6] + '.000Z';

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

            // Add Date information
            logAsDataRecords[i].dateObj = d;
            logAsDataRecords[i].date = dateString;
            logAsDataRecords[i].hour = hours;           

            // This is adding to a count, the hour of the query against it's weekday (Monday, Tuesday....)
            timedata[dayOfWeek][hours] ?? 0; //TODO: time
            timedata[dayOfWeek][hours]++;

            // Transform some values into buttons
            var hideShowButtons = '<button class="showBtn" onclick="showQuery(this);">Show</button> <button class="hideBtn" onclick="hideQuery(this);" style="display:none">Hide</button> <button class="copyToClipboardBtn">Copy</button>';
            logAsDataRecords[i].query_string = hideShowButtons + '<span style="display:none"><br/>' + logAsDataRecords[i].query_string + '</span>';
            if(logAsDataRecords[i].query_with_stripped_where_clauses) {                       
                logAsDataRecords[i].displayed_query_with_stripped_where_clauses = hideShowButtons + '<span style="display:none"><br/>' + logAsDataRecords[i].query_with_stripped_where_clauses+'</span>';
            }    

            // Advance Records reference by one
            i++;

        }

        // Update Onscreen - Progress meter - TODO: This value does not get updated onscreen during loop due to JavaScript limitation
        $('#log_progress').html('Progress : ' + (r / logAsTimeGroups.length) * 100 + '%');

        //TODO: progress timer
        /*setTimeout(() => {
            console.log("Paused for 1 milisecond seconds");
        }, 1);*/

        // Upload progress by bytes //TODO:
        //$('log_progress').html('Progress : '+Math.round(currentStartingBytesOffset*100/f.size) + '%';

    }

    // Empty the uneeded variables to reduce RAM usage - also could use = null; can never unset a varible in JS
    logFileTextBlob = undefined;
    logAsTimeGroups = undefined;
    logAsTextRecords = undefined;    


    //// The Log has been looped and all records extracted ////


    // Count and Add all the occurances of a record's Query Pattern (WHERE clause removed) (Global and Filtered) to it's record
    calculateQueryPatternOccurencesTextOn(logAsDataRecords, 'both');

    // Finished building log, now return the number of records
    return logAsDataRecords.length;

}

// Strips any WHERE clauses and replaces them with a ?
function stripWhereClauses(query) {

    var indexOfWhere = query.toUpperCase().lastIndexOf("WHERE");

    // If no WHERE clause, return
    if(indexOfWhere === -1) {return false}

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
    // Enable the list
    var options = {
        item: 'log_list_item',
        maxVisibleItemsCount: 1000
    };    
    list = new List('log_list', options, logAsDataRecords);
    
    // Change display options
    document.getElementById('drop_zone').style.display = 'none';       // hide the file drag and drop box
    document.getElementById('log_list').style.display = 'table';       // unhide the data table
    document.getElementById('query_results').style.display = 'block';  // unhide the query results

    // When something is changed in the search box, update the table
    $("#log_list_search").keyup(updateTimeChart);

    // This enables the copy to clipboard buttons
    new ClipboardJS('.copyToClipboardBtn', {
        text: function(trigger){
            return trigger.nextElementSibling.innerText;
        }
    });
}


//// Creating Charts Section ////


// Create a Chart
function createChart(
    data,
    firstDate,
    lastDate,
    $timeScaleSelector,
    $chartCanvas,
    $queryCountContainer,
    groupedDataVariableName,
    chartIdentifier              // This chart identifier is created dynamically by Chart.js
)
{   
    // `arguments` is a special variable that holds the calling arguments of this function
    var initialArguments = arguments;

    // When `Time Scale (Group By) :` dropdown is changed
    $timeScaleSelector.off('change');
    $timeScaleSelector.on('change', function(){
        // Re-calling createChart() with same arguments
        createChart.apply(null, initialArguments);
    });
    
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

    // Group records by time segment (timeScaleSegments): copy`data` into new array, add segment index to records, then group records by index (timeScaleRange) (returns object)
    window[groupedDataVariableName] = 

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

    // Build an array of time segments with, a count of records per time segment (only segments with records will get a key/pair value, i.e. some indexes will be missing)
    var countsPerTimeScaleIndex = _(window[groupedDataVariableName]).mapValues('length').value();

    // Build the chart's dataset (records per segment in an array) - Using `timeScaleSegments` create a new array, mapping the count of records against time segment. (this also adds in the missing array indexes)
    var chartDatasetData = _(timeScaleSegments).map(function(timeScaleRange, timeScaleIndex){ return countsPerTimeScaleIndex[timeScaleIndex] || 0; }).value();
    
    // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$("#globalChart")`  ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it using the dynamically created chart identifier (chart.js)
    if(window[chartIdentifier]){ window[chartIdentifier].chartComponent.destroy(); }
    
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
                        autoSkip: false,                // Automatically calculates how many labels can be shown. This also hides the last label (or skipped from callback)
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

                                // Always show the last label (rewuires `autoSkip: false`)
                                index === (ticks.length - 1) ||
                                
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

    // Push the Chart object to the DOM
    window[chartIdentifier] = {
        chartComponent:
            chart,
            timeScaleSegments: timeScaleSegments
    };

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Enable a click function on the chart - the click event creates/updates the working chart, this evt is applied to both the gloabl and working chart.
    $chartCanvas.off('click');
    $chartCanvas.on('click', function(evt) { createWorkingChart(evt, chartIdentifier, firstDate, lastDate); });

    // Show the Chart
    document.getElementById('global_chart_container').style.display = 'block';

}

// Create the GLOBAL chart (using logAsDataRecords as source data)
function createGlobalChart()
{
    // Get date range of the records (date() uses local time)
    var firstDate = _.minBy(logAsDataRecords, 'dateObj').dateObj;
    var lastDate = _.maxBy(logAsDataRecords, 'dateObj').dateObj;

    // Create Chart with this data
    createChart(
        logAsDataRecords,
        firstDate,
        lastDate,
        $("#global_time_scale"),
        $("#globalChart"),
        $("#global_chart_queries_count"),
        'globalGroupedTimescaleData',
        'displayedGlobalChart'
    );

};

// Create WORKING chart (with filtered data) (from a click event)
function createWorkingChart(evt, chartIdentifier, firstDate, lastDate){


    //// Get Data from Global Chart (via the click event) ////
    

    var chartInfos = window[chartIdentifier];

    // `getElementsAtEventForMode` is a Chart.js method to find data points on the chart that are nearest to the event evt (e.g. a mouse click or hover).
    var activePoints = chartInfos.chartComponent.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);

    // This picks the middle point from the array of active (nearest) points.
    var medianPoint = activePoints[Math.floor(activePoints.length/2)];

    // If no median point is found, exit chart creation
    if(!medianPoint) { return; }  

    // Get the median index, which we will use for the source segment's index
    var index = medianPoint.index;

    // Get the source segment's object/array from the chartInfos object.
    var sourceTimeScaleSegment = chartInfos.timeScaleSegments[index];


    //// Filter Data ////

    
    // Ensuring filtering criteria is defined on the window object (if not set, then first click will be implied)
    window.filteringCriteria = window.filteringCriteria || { even: 0, start: null, end: null };

    // Determine whether it's the "start date" (first click) or the "end date" (second click).
    window.filteringCriteria.even = (window.filteringCriteria.even + 1) % 2;

    // On the first click, set the start of the date range (working chart)
    if(window.filteringCriteria.even === 1){

        // Set start of filtering range
        window.filteringCriteria.start = sourceTimeScaleSegment;

        // Update Onscreen - The end date below the working chart (YYYY-MM-DDTHH:mm:ss)
        $("#filterStart").text(window.filteringCriteria.start.startingDate.toISOString().replace('T', ' ').replace(/\..*$/, '')); 
        $("#filterEnd").text(''); 
    
    // On the second click, set the end of the date range (working chart)
    } else {

        // If the start date is greater than the end date, set end to be the same as start (same as double clickling)
        if(window.filteringCriteria.start.startingDate > sourceTimeScaleSegment.startingDate) { window.filteringCriteria.end = window.filteringCriteria.start }

        // Set end of filtering range (normally)
        else { window.filteringCriteria.end = sourceTimeScaleSegment;}

        // Update Onscreen - The end date below the working chart (YYYY-MM-DDTHH:mm:ss)
        $("#filterEnd").text(window.filteringCriteria.end.endingDate.toISOString().replace('T', ' ').replace(/\..*$/, ''));  
    }

    // Build the filtered records
    filterData(window.filteringCriteria);


    //// Output the filtered Data (to the table and working chart) ////


    // Clear and Update the table/list with the filtered records
    list.clear();   
    list.add(filteredData);

    // Create/update the working chart with the filtered data
    createChart(
        filteredData,
        window.filteringCriteria.start ? window.filteringCriteria.start.startingDate : firstDate,
        window.filteringCriteria.end ? window.filteringCriteria.end.endingDate : lastDate,
        $("#working_time_scale"),
        $("#workingChart"),
        $("#working_chart_queries_count"),
        'workingGroupedTimescaleData',
        'displayedWorkingChart'
    );

    // Update Onscreen - Show the chart
    document.getElementById('appliedFilter').style.display = 'block';
    document.getElementById('working_chart_container').style.display = 'block';

}


//// Update and Filter section ////


// Build Filtered Data, using Chart filter criteria (Date) (called from working chart)
function filterData(criteria) {

    // filter the data if a criteria has been specified, if not, just copy logAsDataRecords into filteredData
    filteredData = (criteria.start || criteria.end) ?

        // Return a new array with records that are within the specified criteria
        _.filter(logAsDataRecords, function(item){
            if(criteria.start && !criteria.start.matchesWithLowBound(item.dateObj)) {
                return false;
            }
            if(criteria.end && !criteria.end.matchesWithHighBound(item.dateObj)) {
                return false;
            }
            return true;
        })

        : logAsDataRecords;

    // Update the Query Pattern (WHERE clause removed) occurances for filtered records
    calculateQueryPatternOccurencesTextOn(filteredData, 'filtered');

    return;
}

// TODO: what is this for?
// TODO: not used anywhere
// Filter the table entries and update the screen
// TODO: explain this more, does it do anything, is this something to do with week days?
function updateTimeChart() {
    
    var count = 0;
    var is = list.items;
    var dayOfWeek;    
    var hours;

    // Build an array of hours against days, and then set the dayName TODO: not sure exactly what this is for, needs finisihing
    for (var d = 0; d < 7; d++) {
        for (var hour in timedata[d]) {
            timedata[d][hour] = 0;
        }
        timedata[d].dayName = dayNames[d];
    }
    
    // Search all List Items (records)
    for (var i = 0, il = is.length; i < il && i < 300000; i++) {     
        
        // If this record has a matching value in any of its columns
        if (
            (list.filtered && list.searched && is[i].found && is[i].filtered) ||
            (list.filtered && !list.searched && is[i].filtered) ||
            (!list.filtered && list.searched && is[i].found) ||
            (!list.filtered && !list.searched)
            ) {
        
            // Add this list items values to an object
            var obj = is[i].values();

            hours = obj.hour;                    // TODO: later I specify hours, but not day, should i so noth can be called by objec
            dayOfWeek = obj.dateObj.getUTCDay();
            timedata[dayOfWeek][hours]++;

            // Increment the record counter
            count++;
        }
    }

    // Update Onscreen - number of results
    $("#search_count").text(count + " results ");

}


//// Presentation Section ////


// Reset filtered Results
function resetFilter() {    
    filteredData = null;
    list.clear();
    list.add(logAsDataRecords);
    $("#filterStart").text('');
    $("#filterEnd").text('');    
    $('#appliedFilter').css('display', 'none');
    $('#working_chart_container').css('display', 'none');
    $("#global_time_scale").val('hour'); 
    $("#working_time_scale").val('hour'); 
    createGlobalChart();
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
