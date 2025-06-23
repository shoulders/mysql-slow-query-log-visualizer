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

// Weekdays against ther date() reference number.
var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (var i = 0; i < 7; i++) {
    timedata[i] = {};
    timedata[i].dayName = dayNames[i];
}

// Max Number of X-AXIS labels - Labels are only shown if between 1 and Max number defiend here.
var NB_DISPLAYED_LABELS = 30;   

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

// ??? is needed TODO:
function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy. / A copy of the source item is made at the new location.
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
            var NumberOfEntries = processLog(e.target.result);

            // Update Onscreen - Show processing is complete   
            $('#log_progress').prop('hidden', true );
            $('#information').prop('hidden', true );   
            $('#log_information').prop('hidden', false );   
            $('#log_information_entries').html(NumberOfEntries);            

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

        // Generate an ISO 8601 format date from `# Time:` statement TODO: should i qadd the time zone on the end and then remove later to be better correct
        // (YYYY-MM-DDTHH:mm:ss.sssZ) 
        var date_iso = local_time.match(/([0-9]{2,4})([0-9]{2})([0-9]{2})  ([0-9]{1,2}):([0-9]{2}):([0-9]{2})/);        
        if(date_iso[4].length === 1) {date_iso[4] = '0' + date_iso[4];}   // Add missing 0 onto the hours when needed
        date_iso = '20' + date_iso[1] + '-' + date_iso[2] + '-' + date_iso[3] + 'T' + date_iso[4] + ':' + date_iso[5] + ':' + date_iso[6] + '.000Z';

        // Create Date Object (UTC time)
        // JavaScript's Date object does not natively support timezones.
        // It always converts the input (date or timestamp) to UTC (Zulu) time internally.               
        // How it interprets the input depends on whether a time zone is included in the string.
        // Adding Z (Zulu/UTC timezone)on the end of the string, date() interprets the dates as UTC time, dropping the Z it interprets dates as local time
        // When the time zone offset is absent, date-only forms are interpreted as a UTC time and date-time forms are interpreted as a local time.
        //d = new Date(logAsDataRecords[i].timestamp * 1000); // 1000 milliseconds = 1 second
        var d = new Date(date_iso);  

        // Extract parts of the date (UTC is forced, as I have inputed explicit dates with Z)
        
        var year = d.getFullYear();        
        var month = (d.getMonth() + 1);         // 0 - 11
        var day = d.getDate().toString();       // 1 - 31  
        var hours = d.getHours().toString();    // 0 - 23
        var mins = d.getMinutes().toString();   // 0 - 29
        var secs = d.getSeconds().toString();   // 0 - 59
        var dayOfWeek = d.getDay();             // 0 - 6  (Sunday --> Saturday)

        // TODO: I am not using this for display, so is this needed
        // Add in missing preceeding 0, when needed, to enforce double digits (00-00-00 00:00) TODO: could use padStart here  _.padStart(date.getDate(), 2, "0")
       /* month = _.padStart(month, 2, "0");
        day = _.padStart(day, 2, "0");
        hours = _.padStart(hours, 2, "0");
        mins = _.padStart(mins, 2, "0");
        secs = _.padStart(secs, 2, "0");

        if (month.length === 1) month = "0" + month;   
        if (day.length === 1) day = "0" + day;        
        if (hours.length === 1) hours = "0" + hours;        
        if (mins.length === 1) mins = "0" + mins;
        if (secs.length === 1) secs = "0" + secs;*/

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
            timedata[dayOfWeek][hours] ?? 0;  // TODO: I could fully build the array at the top in timedata, this fixes this. updating the loop a the top is probably more logical. but slightly differnt array name, might be failing from previous programmer that he never buil the array at the top
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

        /*setTimeout(() => {
            console.log("Paused for 1 milisecond seconds");
        }, 1);*/

        // Upload progress by bytes
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
        maxVisibleItemsCount: 3000
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
    debugGroupedDataGlobalVariableName,
    chartIdentifier
)
{   
    // When `Time Scale (Group By) :` dropdown is changed
    $timeScaleSelector.off('change');
    $timeScaleSelector.on('change', function(){
        // `arguments` is a special variable that holds the calling arguments of this function
        var initialArguments = arguments;

        // Re-calling createChart() with same arguments
        createChart.apply(null, initialArguments);
    });

    
    // Return X-AXIS segement specifications (Length in milliseconds / Label Format via a function)
    // _.padStart() = is adding in a "0" when minute/hour/day/week only has 1 character    
    // TODO: This needs tidying and making simpler
    // TODO: maybe use regex to take the string an maye it better?????
    // format = A stored function that can be called. Returns specifically formated dates/times for the sel;ected segmenet type.    
    var timeScaleSpecification = {
        minute: {
            numberOfMillis: 60 * 1000,
            format: function(date) {return _.padStart(date.getDate(), 2, "0") + "/" + _.padStart(date.getMonth() + 1, 2, "0") + " " + _.padStart(date.getHours(), 2, "0") + ":"+ _.padStart(date.getMinutes(), 2, "0");}
        }, hour: {
            numberOfMillis: 3600*1000,
            format: function(date){ return _.padStart(date.getDate(), 2, "0") + "/" + _.padStart(date.getMonth() + 1, 2, "0") + " " + _.padStart(date.getHours(), 2, "0") + "h"; }
        }, day: {
            numberOfMillis: 3600*1000*24,
            format: function(date){ return _.padStart(date.getDate(), 2, "0") + "/" + _.padStart(date.getMonth() + 1, 2, "0"); }
        }, week: {
            numberOfMillis: 3600*1000*24*7,
            format: function(date){ return _.padStart(date.getDate(), 2, "0") + "/" + _.padStart(date.getMonth() + 1, 2, "0"); }
        }
    };
    var currentTimeScale = timeScaleSpecification[$timeScaleSelector.val()];   



    
    // X-AXIS Segements
    var timeScaleRanges = _(

        // jon: (endtimestamp - starttimestamp) / currentTimeScale.numberOfMillis

        //TODO: the whole section - notes and make neater


        // Creates an array of numbers (positive and/or negative) progressing from start up to, but not including, end. 
        //         a segment doe not start at the end, but the at the pneumultimate location
        // The specifiers (not array items) below, are the start and end of the range
        // the .range() will return all of the integers between  the start and end date (after they have been converted in to segment numbers)
        //  example  [] = [20194, 20195, 20196]
        _.range(      

            // These are breaking up the start and end date by the selected segment length (eg day, week)
            // The numbers used here are timestamps
            //eg sgement = week --> the will return date's weeks number from the epoch

            // Math.Floor() = Round result down to nearest integer - the number of days might not exactly match the number of days in a segement sizxe leading to decimals,
            // = number of segments from the epoch
            // math.floor() ensures we use the timestamp of the start of the segement this date appears (in i.e. a complete segment), by rounding down to nearest integer.
            // math.floor is needed because: ........................
            Math.floor((firstDate.getTime())/(currentTimeScale.numberOfMillis)),    

            // = number of segments from the epoch         
            // math.floor() is not needed because: the beginning of the segment is always included and .range() only returns integers
            (lastDate.getTime())/(currentTimeScale.numberOfMillis)

        )
    )

    // map() returns a new array, of this data (does this make an array oof the range above, i thought thats what it do)
    // This is taking the newly created range array from above (1,2,3,4,5,.....) and then running them all through this function.
    // (index, itemsIndex, items) are special variables
    // loop throug all array items, apply the function and then return a new array.
    .map(                  
                
        function(index, itemsIndex, items){  // FIXME: this will not be using localtime

            var chikc = index;        // this is the current item = 484681
            var turkey = itemsIndex;  //this is advaced 1 each loop, staring at 0 = 1,2,3,4
            var bird = items;         // all segements in array as an array = array[]

            // Convert this segement's number back into timestamp and then a date object
            var startingDate = new Date(index * currentTimeScale.numberOfMillis)

            // Add the next segment's number as this segements end. (same as above)
            var endingDate = new Date((index + 1) * currentTimeScale.numberOfMillis);
            
            // Show labels only if segments is less than or equals `NB_DISPLAYED_LABELS`. One label will always be shown
            var displayLabel = (items.length <= NB_DISPLAYED_LABELS) || (itemsIndex % (Math.round(items.length/NB_DISPLAYED_LABELS)) === 0);
            //var label = displayedLabel ? currentTimeScale.format(startingDate) : "";     // TODO: can this now be put directly into the return statement below

            return {
                startingDate: new Date(index * currentTimeScale.numberOfMillis),     // date object
                endingDate: new Date((index + 1) * currentTimeScale.numberOfMillis),         // date object
                label: displayLabel ? currentTimeScale.format(startingDate) : "",                   // label string
                matchesWithLowBound: function(date) { return startingDate.getTime()<=date.getTime(); },  //??
                matchesWithHighBound: function(date) { return endingDate.getTime()>date.getTime(); },    //??
                matchesWith: function(date) { return this.matchesWithLowBound(date) && this.matchesWithHighBound(date); //??

                }
            };
        }
    )

    // Returns the .map() array
    .value();

    // TODO: what does this do
    window[debugGroupedDataGlobalVariableName] = _(data).map(function(data){
        return _.extend({}, data, {
            timeScaleIndex: _.findIndex(timeScaleRanges, function(range){ return range.matchesWith(data.dateObj); })
        });
    }).groupBy('timeScaleIndex').value();

    // Count the number of occurences per time segment (only used below)
    var countsPerTimeScaleIndex = _(window[debugGroupedDataGlobalVariableName]).mapValues('length').value();

    // TODO: better name for variable  `datasetsData`
    // Using `timeScaleIndex`, map the count of Queries per time segement, to the time segment
    var datasetsData = _(timeScaleRanges).map(function(timeScaleRange, timeScaleIndex){ return countsPerTimeScaleIndex[timeScaleIndex] || 0; }).value();

    // 2D rendering context of the canvas, taken from the Reference to the canvas element [e,g. `$chartCanvas` --> `$("#globalChart")`  ]
    var ctx = $chartCanvas.get(0).getContext("2d");

    // If the chart already exists, destroy it using the dynamically created chart identifier (chart.js)
    if(window[chartIdentifier]){        
        window[chartIdentifier].chartComponent.destroy();;
    }

    // Instanciate Chart Class
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: _.map(timeScaleRanges, "label"),
            datasets: [{
                label: "Number of Queries",
                fillColor: "rgba(220,220,220,0.2)",
                strokeColor: "hsl(0, 0.00%, 86.30%)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                data: datasetsData,
            }]
        },
        options: {
            pointHitDetectionRadius: 1,
            scales: {

                // X- AXIS configuration
                x: {
                    stacked: false,
                    barPercentage: 1.0,                     // Removes spacing between bars = no working TODO:
                    categoryPercentage: 1.0,                // Removes spacing between categories = not working TODO: was needed for bar spacing ?
                    title: {
                        display: true,
                        text: 'Time of Request'             // Label for the x-axis
                    },
                    /*ticks: {
                        stepSize: 1,                        // Customize tick intervals
                        color: 'blue'                       // Change tick color
                    },
                    grid: {
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
                    /*ticks: {
                        stepSize: 1,                        // Customize tick intervals
                        color: 'blue'                       // Change tick color
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.5)' // Customize grid line color
                    }*/
                }
            }
        }
    });

    // TODO: whats is this for??
    window[chartIdentifier] = {
        chartComponent: chart,
        // Hack to be able to retrieve index from x coordinate
        datasetIndexFromPointResolvers: _.map(chart.datasets, function(dataset) {
            return {
                indexFromPoint: _(dataset.points).pluck('x').invert().value()
            };
        }),
        timeScaleRanges: timeScaleRanges
    };

    // Update Onscreen -  the current number of queries being displayed
    $queryCountContainer.html("Displaying " + data.length + " queries");

    // Enable a click function on the chart
    $chartCanvas.off('click');
    $chartCanvas.on('click', function(evt) {
        createWorkingChart(evt, chartIdentifier, firstDate, lastDate);
    });

    // Show the chart
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
        'displayedGlobalChart'     // This chart identifier is created dynamically by Chart.js
    );

};

// Create WORKING chart (with filtered data)
function createWorkingChart(evt, chartIdentifier, firstDate, lastDate){

    var chartInfos = window[chartIdentifier];

    // old - var activePoints = chartInfos.chartComponent.getPointsAtEvent(evt);
    var activePoints = chartInfos.chartComponent.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
    var medianPoint = activePoints[Math.floor(activePoints.length/2)];
    if(!medianPoint) { return; }
    
    //var targetTimeScaleRange = chartInfos.timeScaleRanges[chartInfos.datasetIndexFromPointResolvers[0].indexFromPoint[medianPoint.x]];
    var index = medianPoint.index;
    var targetTimeScaleRange = chartInfos.timeScaleRanges[index];

    // Ensuring filtering criteria is defined
    window.filteringCriteria = window.filteringCriteria || { even: 0, start: null, end: null };

    window.filteringCriteria.even = (window.filteringCriteria.even + 1)%2;
    if(window.filteringCriteria.even === 1){
        window.filteringCriteria.start = targetTimeScaleRange;
        $("#filterStart").text(window.filteringCriteria.start.startingDate.toString());
    } else {
        window.filteringCriteria.end = targetTimeScaleRange;
        $("#filterEnd").text(window.filteringCriteria.end.endingDate.toString());
    }

    // Get the filtered records
    filterData(logAsDataRecords, window.filteringCriteria);

    // Clear and Update the table/list with the filtered records
    list.clear();   
    list.add(filteredData);

    // Create the working chart with the filtered data
    createChart(
        filteredData,
        window.filteringCriteria.start ? window.filteringCriteria.start.startingDate : firstDate,
        window.filteringCriteria.end ? window.filteringCriteria.end.endingDate : lastDate,
        $("#working_time_scale"),
        $("#workingChart"),
        $("#working_chart_queries_count"),
        'workingGroupedTimescaleData',
        'displayedWorkingChart'   // This chart identifier is created dynamically by Chart.js
    );

    // Show the chart
    document.getElementById('working_chart_container').style.display = 'block';

}


//// Update and Filter section ////


// Filter Data (by Datetime)
function filterData(data, criteria) {

    filteredData = (criteria.start || criteria.end) ?

        _.filter(data, function(item){
            if(criteria.start && !criteria.start.matchesWithLowBound(item.dateObj)) {
                return false;
            }
            if(criteria.end && !criteria.end.matchesWithHighBound(item.dateObj)) {
                return false;
            }
            return true;
        })

        : data;

    // Update the Query Pattern (WHERE clause removed) occurances for filtered records
    calculateQueryPatternOccurencesTextOn(filteredData, 'filtered');

    return;
}

// Filter the table entries and update the screen
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
            dayOfWeek = obj.dateObj.getDay();
            timedata[dayOfWeek][hours]++;

            // Increment the record counter
            count++;
        }
    }

    // Update Onscreen - number of results
    $("#search_count").text(count + " results ");

    //$('.visualize').trigger('visualizeRefresh');  // can find this anywhere, try again
    //window[WorkingChart].chartComponent.update(); // Refresh the working chart
    //window[workingChart].chartComponent.update();
    //window[WorkingChart].update();
    //window[workingChart].update();
}


//// Presentation Section ////


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
