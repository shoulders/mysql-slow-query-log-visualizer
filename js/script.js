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

// Global Variables
var logAsDataRecords = [];
var timedata = [];
var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (var i = 0; i < 7; i++) {
    timedata[i] = {};
    timedata[i].dayName = dayNames[i];
}
var list;

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

// orig
function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

// Upload the file and pass log to processing (Main function)
function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    // files is a FileList of File objects. List some properties.
    var files = evt.dataTransfer.files;    
    var f = files[0];

    // Update onscreen - Show uploaded file information
    $('#log_information_file').html('<span class="log_information_title">File:</span> ' + f.name + ' (' + f.size + ' bytes)');

    // Variable to hold the file object
    var reader = new FileReader();

    // Closure to capture the file.    
    reader.onloadend = function(e) {

        // When the file has been uploaded
        if (e.target.readyState == FileReader.DONE) {

            // Update onscreen - Show file is now being process
            $('#log_progress').html('hidden', false);           

            // Process the log and return number of records
            var NumberOfEntries = processLog(e.target.result);

            // Update onscreen - Show processing is complete   
            $('#log_progress').prop('hidden', true );
            $('#information').prop('hidden', true );   
            $('#log_information').prop('hidden', false );   
            $('#log_information_entries').html('<span class="log_information_title">Entries:</span> ' + NumberOfEntries);            

            // Change screen from file dropbox, create and display the table         
            try {
                createList();
            } catch (error) {
                console.log(error);
            }

            // Create and display the Chart
            try {
                createChartFromlogAsDataRecords();
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

// Process the uploaded slow query log, parseout the records
function processLog(logFileTextBlob) {
    var log_entry;
    var log_entry_lines;
    var date_string;
    var query_request_stats;     

    // Split by time group to allow for correct local time string  ***I could use the timestamp later on to add seconds on to the time if needed**
    var logAsTimeGroups = logFileTextBlob.split(/(?=# Time: )/);

    // Check if the first record is a log header
    if(logAsTimeGroups[0].search(/Version:/)) {

        // Update onscreen - Server information
        var serverDetails = logAsTimeGroups[0].match(/(.*), Version: (.*) \((.*)\)/);
        /*$('#server_details_binary').html(serverDetails[1]);
        $('#server_details_version').html(serverDetails[2]);
        $('#server_details_flavour').html(serverDetails[3]);*/
        $('#server_details').html('<span class="log_information_title">Server:</span> ' + serverDetails[3] + ' (' + serverDetails[2] + ')')

        // Remove this record
        logAsTimeGroups.shift();
    }

    // Intialise the `i` variable - done here to maintain numbering over timegroups
    var i = 0;

    // Cycle through the records grouped by time (eg: # Time: 250417  2:20:32)
    for (var t = 0; t < logAsTimeGroups.length; t++) {

        // Grab the Group Time and remove the relevant line
        local_time = logAsTimeGroups[t].match(/# Time: (.*)\n/)[1];   // could use (\r?\n)        
        logAsTimeGroups[t] = logAsTimeGroups[t].replace(/# Time: .*\n/, '');

        // Split the time text groups into records into an array by splitting at "# User@Host: " + keeps separator
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
            logAsDataRecords[i].local_time = local_time;

            // Add User, DB, Host
            //var logAsTextRecords = logFileTextBlob.split("# User@Host: ");  --- use regex to get all 3 groups
            logAsDataRecords[i].db_name = log_entry_lines[0].split("[")[1].split("]")[0];

            // Add Thread_id/Schema/QC....  line 1
            /////////////////////

            // Add Query Stats (Request)
            query_request_stats = log_entry_lines[2].split(" ");
            logAsDataRecords[i].query_time = query_request_stats[2].trim();      // Query time
            logAsDataRecords[i].lock_time = query_request_stats[5].trim();       // Lock time
            logAsDataRecords[i].rows_sent = query_request_stats[8].trim();       // Rows sent
            logAsDataRecords[i].rows_examined = query_request_stats[11].trim();  // Rows examined

            // Add Query Stats (Result) Stats rows_Affected/Bytes_sent
            query_result_stats = log_entry_lines[3].split(" ");
            logAsDataRecords[i].rows_affected = query_result_stats[2].trim();      // Query time
            logAsDataRecords[i].bytes_sent = query_result_stats[5].trim();       // Lock time

            // `use` Statement - Not all queries have this line, remove if found.
            if (log_entry_lines[4].substr(0,3) == "use") {
                log_entry_lines.shift(); 
            }

            // Timestamp
            logAsDataRecords[i].timestamp = log_entry_lines[4].match(/SET timestamp=(.*);/)[1];
            //logAsDataRecords[i].timestamp = log_entry_lines[4].split("SET timestamp=")[1].split(";")[0];

            // Add Query String
            //logAsDataRecords[i].query_string = log_entry_lines.join("\n").split("# Time: ")[0]; this is weired, i think it never worked propely
            logAsDataRecords[i].query_string = log_entry_lines[5];

             // isolate query  *** not sure what this does - removing blank lines at the end? - ot sure this is needeed - think used to grab query   
            /*log_entry_lines.shift();
            log_entry_lines.shift();
            log_entry_lines.shift();*/     
            

            //// All data has been extracted from the log - Process as required ////


            // Add Query String stripped of the `WHERE` clauses
            logAsDataRecords[i].query_with_stripped_where_clauses = stripWhereClauses(logAsDataRecords[i].query_string);

            // Correct date string (if required)
            /////////////////////////////

            // Get Date String Obj  (maybe use the local_time for this)
            d = new Date(logAsDataRecords[i].timestamp * 1000); // 1000 milliseconds = 1 second
            var year = d.getFullYear();        
            var month = (d.getUTCMonth() + 1) + ""; // January = 0, February = 1, ...
            var day = d.getDate().toString();
            var dayOfWeek = d.getDay();        
            var hours = d.getHours().toString();
            var mins = d.getMinutes().toString();
            var secs = d.getSeconds().toString();

            // Building a text string and then adding a zero on the front for a better date/time display (eg 00/00/00 00:00)
            if (month.length == 1) month = "0" + month;   
            if (day.length == 1) day = "0" + day;        
            if (hours.length == 1) hours = "0" + hours;        
            if (mins.length == 1) mins = "0" + mins;
            if (secs.length == 1) secs = "0" + secs;

            date_string = year + "/" + month + "/" + day + " " + hours + ":" + mins + ":" + secs;
            //console.log(date.toISOString()); // Outputs: 1970-01-01T00:00:01.000Z
            
            // Add Date information
            logAsDataRecords[i].dateObj = d; // This date object is used in many functions in this code, probably for sorting/filtering
            logAsDataRecords[i].date = date_string;
            logAsDataRecords[i].hour = hours;           

            // Time Stats - is this setting a defult start time??
            if (timedata[dayOfWeek][hours] == null) {
                timedata[dayOfWeek][hours] = 0;
            }        
            timedata[dayOfWeek][hours]++;

            // Advance `i` by one
            i++;

        }

        // Update onscreen - Progress meter - This value does not get updated onscreen during loop due to JavaScript limitation
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


    //// The Log has been looped and Records built ////


    ///////////////// this section is a bitt weired, does it need to be here


    var dataGroupedByStrippedQueries = _.groupBy(logAsDataRecords, 'query_with_stripped_where_clauses');

    // Parse through all records and all their data fields - this is handled by lodash library _.each()
    _.each(logAsDataRecords, function(data) {
        
        // Build Buttons (this is cheeky, putting html in the logic)  -- this could be done on the loop above
        var hideShowButtons = '<button class="showBtn" onclick="showQuery(this);">Show</button> <button class="hideBtn" onclick="hideQuery(this);" style="display:none">Hide</button> <button class="copyToClipboardBtn">Copy</button>';
        data.query_string = hideShowButtons+'<span style="display:none"><br/>'+data.query_string+'</span>';        
        if(data.query_with_stripped_where_clauses) {                       
            data.displayed_query_with_stripped_where_clauses = hideShowButtons+'<span style="display:none"><br/>'+data.query_with_stripped_where_clauses+'</span>';
        }

        // Some sort of sorting by the where clauses -is this adding a sort field pf query by lenght with WHERE
        data.query_pattern_global_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;
    });

    calculateQueryPatternOccurencesTextOn(logAsDataRecords);

    return logAsDataRecords.length;

}

// Strips any WHERE clauses and replaces them with a ? - Not sure of why you would want this.
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

    // chunk to replace on no WHERE = " "
    return initialRadical + chunkToReplace;
}

// not present
function calculateQueryPatternOccurencesTextOn(dataItems) {
    var dataGroupedByStrippedQueries = _.groupBy(dataItems, 'query_with_stripped_where_clauses');
    _.each(dataItems, function(data) {
        data.query_pattern_filtered_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;
    });
}

// Filter Data (by Datetime)
function filterData(data, criteria) {
    var filteredData = (criteria.start || criteria.end) ?    
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

    calculateQueryPatternOccurencesTextOn(filteredData);

    return filteredData;
}

// Copy Button
function copyQuery(_this) {
    copy($(_this).siblings("span").text());
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

// different - Change from file dropbox to data table
function createList ()
{
    var options = {
        item: 'log_list_item',
        maxVisibleItemsCount: 3000
    };
    
    list = new List('log_list', options, logAsDataRecords);
    
    document.getElementById('drop_zone').style.display = 'none';       // hide the file drag and drop box
    document.getElementById('log_list').style.display = 'table';       // unhide the data table
    document.getElementById('query_results').style.display = 'block';  // unhide the query results

    $("#log_list_search").keyup(updateTimeChart);

    // Is this needed, there is also a copy command on the copy button, so secondary do i need to bind an event)
    new ClipboardJS('.copyToClipboardBtn', {
        text: function(trigger){
            return trigger.nextElementSibling.innerText;
        }
    });
}

// not present -  build the graph
function createChartFromlogAsDataRecords()
{
    // Get data range of the records -- could use the timestamp fieled
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

// Global/Working chart
function createChart(
    data,
    firstDate,
    lastDate,
    $timeScaleSelector,
    $targetChartCanvas,
    $queryCountContainer,
    debugGroupedDataGlobalVariableName,
    chartGlobalVariableName
)
{

    var initialArguments = arguments;

    $timeScaleSelector.off('change');
    $timeScaleSelector.on('change', function(){
        // Re-calling create charts with same arguments
        createChart.apply(null, initialArguments);
    });

    var TIME_SCALES = {
        minutely: {
            numberOfMillis: 60 * 1000,
            format: function (date) {
                return _.padStart(date.getDate(), 2, "0") + "/" + _.padStart(date.getMonth() + 1, 2, "0") + " " + _.padStart(date.getHours(), 2, "0") + ":"+ _.padStart(date.getMinutes(), 2, "0");
            }
        }, hourly: {
            numberOfMillis: 3600*1000,
            format: function(date){ return _.padStart(date.getDate(), 2, "0")+"/"+ _.padStart(date.getMonth()+1, 2, "0")+" "+ _.padStart(date.getHours(), 2, "0")+"h"; }
        }, daily: {
            numberOfMillis: 3600*1000*24,
            format: function(date){ return _.padStart(date.getDate(), 2, "0")+"/"+ _.padStart(date.getMonth()+1, 2, "0"); }
        }, weekly: {
            numberOfMillis: 3600*1000*24*7,
            format: function(date){ return _.padStart(date.getDate(), 2, "0")+"/"+ _.padStart(date.getMonth()+1, 2, "0"); }
        }
    };
    var currentTimeScale = TIME_SCALES[$timeScaleSelector.val()];
    var NB_DISPLAYED_LABELS = 30;
    var timeScaleRanges = _(_.range(Math.floor((firstDate.getTime())/(currentTimeScale.numberOfMillis)), (lastDate.getTime())/(currentTimeScale.numberOfMillis))).map(
        function(index, itemsIndex, items){
            var startingDate = new Date(index*currentTimeScale.numberOfMillis), endingDate = new Date((index+1)*currentTimeScale.numberOfMillis);
            var displayedLabel = (items.length < NB_DISPLAYED_LABELS) || (itemsIndex % (Math.round(items.length/NB_DISPLAYED_LABELS)) === 0);
            var label = displayedLabel?currentTimeScale.format(startingDate):"";
            return {
                startingDate: startingDate,
                endingDate: endingDate,
                label: label,
                matchesWithLowBound: function(date) { return startingDate.getTime()<=date.getTime(); },
                matchesWithHighBound: function(date) { return endingDate.getTime()>date.getTime(); },
                matchesWith: function(date) { return this.matchesWithLowBound(date) && this.matchesWithHighBound(date); }
            };
        }
        ).value();

    window[debugGroupedDataGlobalVariableName] = _(data).map(function(data){
        return _.extend({}, data, {
            timeScaleIndex: _.findIndex(timeScaleRanges, function(range){ return range.matchesWith(data.dateObj); })
        });
    }).groupBy('timeScaleIndex').value();

    var countsPerTimeScaleIndex = _(window[debugGroupedDataGlobalVariableName]).mapValues('length').value();

    var datasets = [{
        label: "Number of Queries",
        fillColor: "rgba(220,220,220,0.2)",
        strokeColor: "hsl(0, 0.00%, 86.30%)",
        pointColor: "rgba(220,220,220,1)",
        pointStrokeColor: "#fff",
        pointHighlightFill: "#fff",
        pointHighlightStroke: "rgba(220,220,220,1)",
        data: _(timeScaleRanges).map(function(timeScaleRange, timeScaleIndex){ return countsPerTimeScaleIndex[timeScaleIndex] || 0; }).value()
    }];

    var $chartCanvas = $targetChartCanvas;
    var ctx = $chartCanvas.get(0).getContext("2d");
    if(window[chartGlobalVariableName]){
        window[chartGlobalVariableName].chartComponent.destroy();
    }

    // Instanciate Chart Class
    var chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: _.map(timeScaleRanges, "label"),
            datasets: datasets
        },
        options: {
            pointHitDetectionRadius: 1
        }
    });

    window[chartGlobalVariableName] = {
        chartComponent: chart,
        // Hack to be able to retrieve index from x coordinate
        datasetIndexFromPointResolvers: _.map(chart.datasets, function(dataset) {
            return {
                indexFromPoint: _(dataset.points).pluck('x').invert().value()
            };
        }),
        timeScaleRanges: timeScaleRanges
    };

    // Update the current number of queries being displayed
    $queryCountContainer.html("Displaying "+data.length+" queries");

    // Make sure the click posistion is off (is this needed ??)
    $chartCanvas.off('click');

    // I should not have the secondary chart logic in the promary chart logic / double clicking either chart will then update the working chart
    //$chartCanvas.on('click', CreateWorkingChart($chartCanvas, chartGlobalVariableName));
    CreateWorkingChart($chartCanvas, chartGlobalVariableName);

    
    
    /* Create Working Chart When the global chart is clicked    
    $chartCanvas.on('click', function(evt){

        var chartInfos = window[chartGlobalVariableName];
        // old - var activePoints = chartInfos.chartComponent.getPointsAtEvent(evt);
        var activePoints = chartInfos.chartComponent.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
        var medianPoint = activePoints[Math.floor(activePoints.length/2)];
        if(!medianPoint) { return; }
        
        //var targetTimeScaleRange = chartInfos.timeScaleRanges[chartInfos.datasetIndexFromPointResolvers[0].indexFromPoint[medianPoint.x]];
        var index = medianPoint.index;
        var targetTimeScaleRange = chartInfos.timeScaleRanges[index];

        // Ensuring filtering criteria is defined
        window.filteringCriteria = window.filteringCriteria || { even: 0, start: null, end: null };

        window.filteringCriteria.even = (window.filteringCriteria.even+1)%2;
        if(window.filteringCriteria.even === 1){
            window.filteringCriteria.start = targetTimeScaleRange;
            $("#filterStart").text(window.filteringCriteria.start.startingDate.toString());
        } else {
            window.filteringCriteria.end = targetTimeScaleRange;
            $("#filterEnd").text(window.filteringCriteria.end.endingDate.toString());
        }

        list.clear();
        var filteredData = filterData(logAsDataRecords, window.filteringCriteria);
        list.add(filteredData);

        // Create the working chart with filtered data
        createChart(
            filteredData,
            window.filteringCriteria.start?window.filteringCriteria.start.startingDate:firstDate,
            window.filteringCriteria.end?window.filteringCriteria.end.endingDate:lastDate,
            $("#working_time_scale"),
            $("#workingChart"),
            $("#working_chart_queries_count"),
            'workingGroupedTimescaleData',
            'displayedWorkingChart'
        );

        document.getElementById('working_chart_container').style.display = 'block';
    });*/








    document.getElementById('global_chart_container').style.display = 'block';
}

// Create Working Chart When the global chart is clicked    
function CreateWorkingChart($chartCanvas, chartGlobalVariableName){
        

    $chartCanvas.on('click', function(evt){

        var chartInfos = window[chartGlobalVariableName];
        // old - var activePoints = chartInfos.chartComponent.getPointsAtEvent(evt);
        var activePoints = chartInfos.chartComponent.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
        var medianPoint = activePoints[Math.floor(activePoints.length/2)];
        if(!medianPoint) { return; }
        
        //var targetTimeScaleRange = chartInfos.timeScaleRanges[chartInfos.datasetIndexFromPointResolvers[0].indexFromPoint[medianPoint.x]];
        var index = medianPoint.index;
        var targetTimeScaleRange = chartInfos.timeScaleRanges[index];

        // Ensuring filtering criteria is defined
        window.filteringCriteria = window.filteringCriteria || { even: 0, start: null, end: null };

        window.filteringCriteria.even = (window.filteringCriteria.even+1)%2;
        if(window.filteringCriteria.even === 1){
            window.filteringCriteria.start = targetTimeScaleRange;
            $("#filterStart").text(window.filteringCriteria.start.startingDate.toString());
        } else {
            window.filteringCriteria.end = targetTimeScaleRange;
            $("#filterEnd").text(window.filteringCriteria.end.endingDate.toString());
        }

        list.clear();
        var filteredData = filterData(logAsDataRecords, window.filteringCriteria);
        list.add(filteredData);

        // Create the working chart with filtered data
        createChart(
            filteredData,
            window.filteringCriteria.start?window.filteringCriteria.start.startingDate:firstDate,
            window.filteringCriteria.end?window.filteringCriteria.end.endingDate:lastDate,
            $("#working_time_scale"),
            $("#workingChart"),
            $("#working_chart_queries_count"),
            'workingGroupedTimescaleData',
            'displayedWorkingChart'
        );

        document.getElementById('working_chart_container').style.display = 'block';
    });
}













// different
function updateTimeChart () {
    
    var count = 0;
    var is = list.items;
    var dayOfWeek;
    
    var hours;
    for (var d = 0; d < 7; d++) {
        for (var hour in timedata[d]) {
            timedata[d][hour] = 0;
        }
        timedata[d].dayName = dayNames[d];
    }
    
    for (var i = 0, il = is.length; i < il && i < 300000; i++) {
        if (
            (list.filtered && list.searched && is[i].found && is[i].filtered) ||
            (list.filtered && !list.searched && is[i].filtered) ||
            (!list.filtered && list.searched && is[i].found) ||
            (!list.filtered && !list.searched)
            ) {
            var obj = is[i].values();
            hours = obj.hour;
            dayOfWeek = obj.dateObj.getDay();
            timedata[dayOfWeek][hours]++;
            count++;
        }
    }
    $("#search_count").text(count + " results ");
    $('.visualize').trigger('visualizeRefresh');
}





/* use this code to make a processing progress bar 
function donotuse(){
    document.getElementById('log_information').innerHTML = '<h2>Loading ' + output.join('') + '</h2>';
    
    logAsDataRecords = [];

    var loadProgress = document.getElementById('loadProgress');

    var CHUNK_SIZE = 10*1000*1000;// Reading chunks of 10Mo
    var currentStartingBytesOffset = 0;
    var latestEntryText = "";


            // Is this the last chunk of the file
        if(latestChunk) {


            loadProgress.innerHTML = "Progress : 100%";

            var span = document.createElement('span');
            span.innerHTML = "Imported " + logAsDataRecords.length + " entries.";
            document.getElementById('load_result').insertBefore(span, null);

            // Change from file dropbox to data table
            createList();

            // create the chart
            createChartFromlogAsDataRecords();

        } else {
            loadProgress.innerHTML = "Progress : "+Math.round(currentStartingBytesOffset*100/f.size)+"%";

            latestEntryText = result.latestEntryText;
            currentStartingBytesOffset += CHUNK_SIZE;

            readFileChunk(f, currentStartingBytesOffset, currentStartingBytesOffset+CHUNK_SIZE).then(handleFileChunkRead);
        }
    };

    readFileChunk(f, 0, CHUNK_SIZE).then(handleFileChunkRead);
}*/




