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

// Process the uploaded slow query log, parseout the records
function processLog(logText) {
    var log_entry;
    var log_lines;
    var date_string;
    var entry_stats;     

    // Split the text blob into records into an array by splitting at "# User@Host: "
    var logTextAsRecords = logText.split("# User@Host: ");   // chunking is relying on a smooth cut between records = bad

    // remove the first element from an array and return that removed element.
    // It modifies the original array by reducing its length by one.
    // If the array is empty, it returns undefined.
    // I think this removes the header - NB: header is not always present so will need to be address otherwise the first record is lost
    logTextAsRecords.shift();    
    
    // Cycle through the extracted text records array and process them in to usable records in a new array
    for (var i = 0; i < logTextAsRecords.length; i++) {

        // Make an array for the new record
        logdata[i] = {};

        // Load text record for processing        
        log_entry = logTextAsRecords[i];

        // Split the record into separate lines for easier processing
        log_lines = log_entry.split("\n");

        // not sure what this gets/does ****** is thi sin the right place
        entry_stats = log_lines[1].split(" ");

        // Add Host
        logdata[i].db_name = log_lines[0].split("[")[1].split("]")[0];

        // Add Thread_id/Schema/QC....
        /////////////////////

        // Add Query Stats
        logdata[i].query_time = entry_stats[2]; // Query time
        logdata[i].lock_time = entry_stats[5]; // Lock time
        logdata[i].rows_sent = entry_stats[7]; // Rows sent
        logdata[i].rows_examined = entry_stats[10]; // Rows examined

        // Database Interaction Stats
        //////////////////////////

        // Get Date String
        if (log_lines[2].substr(0,3) == "use") {
            log_lines.shift(); 
        }

        date_string = log_lines[2].split("SET timestamp=")[1].split(";")[0];
        
        d = new Date(date_string * 1000);        
        var year = d.getFullYear();        
        var month = (d.getUTCMonth() + 1) + "";
        if (month.length == 1) month = "0" + month;        
        var day = d.getDate().toString();
        if (day.length == 1) day = "0" + day;        
        var dayOfWeek = d.getDay();        
        var hours = d.getHours().toString();
        if (hours.length == 1) hours = "0" + hours;        
        var mins = d.getMinutes().toString();
        if (mins.length == 1) mins = "0" + mins;
        var secs = d.getSeconds().toString();
        if (secs.length == 1) secs = "0" + secs;

        date_string = year + "/" + month + "/" + day + " " + hours + ":" + mins + ":" + secs;
        
        // Add Date
        logdata[i].dateObj = d; // date
        logdata[i].date = date_string;
        logdata[i].hour = hours;
        
        // isolate query  *** not sue what this does
        
        log_lines.shift();
        log_lines.shift();
        log_lines.shift();
        
        // Add Query Strings
        logdata[i].query_string = log_lines.join("\n").split("# Time: ")[0]; // query
        logdata[i].query_with_stripped_where_clauses = stripWhereClauses(logdata[i].query_string);

        // Time Stats        
        if (timedata[dayOfWeek][hours] == null) {
            timedata[dayOfWeek][hours] = 0;
        }        
        timedata[dayOfWeek][hours]++;
    }

    var dataGroupedByStrippedQueries = _.groupBy(logdata, 'query_with_stripped_where_clauses');

    
    // Parse through all records and all their data fields - this does not loop them (this is handled by lodash library _.each() )
    _.each(logdata, function(data) {
        
        // Build Buttons (this is cheeky, putting html in the logic)
        var hideShowButtons = '<button class="showBtn" onclick="showQuery(this);">Show</button> <button class="hideBtn" onclick="hideQuery(this);" style="display:none">Hide</button> <button class="copyToClipboardBtn">Copy</button>';
        data.query_string = hideShowButtons+'<span style="display:none"><br/>'+data.query_string+'</span>';        
        if(data.query_with_stripped_where_clauses) {                       
            data.displayed_query_with_stripped_where_clauses = hideShowButtons+'<span style="display:none"><br/>'+data.query_with_stripped_where_clauses+'</span>';
        }

        // Some sort of sorting by the where clauses
        data.query_pattern_global_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;
    });

    calculateQueryPatternOccurencesTextOn(logdata);

    return logdata.length;
}

// not present
function copyQuery(_this) {
  copy($(_this).siblings("span").text());
}

// not present
function calculateQueryPatternOccurencesTextOn(dataItems) {
    var dataGroupedByStrippedQueries = _.groupBy(dataItems, 'query_with_stripped_where_clauses');
    _.each(dataItems, function(data) {
        data.query_pattern_filtered_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;
    });
}

// not present
function showQuery(node) {
    $(node).siblings('span').show();
    $(node).siblings('.hideBtn').show();
    $(node).hide();
}

// not present
function hideQuery(node) {
    $(node).siblings('span').hide();
    $(node).hide();
    $(node).siblings('.showBtn').show();
}

// not present
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

// different - Change from file dropbox to data table
function createList ()
{
    var options = {
        item: 'log_list_item',
        maxVisibleItemsCount: 3000
    };
    
    list = new List('log_list', options, logdata);
    
    document.getElementById('drop_zone').style.display = 'none';  // hide the rop file box
    document.getElementById('log_list').style.display = 'table';  // unhide the data table

    document.getElementById('query_results').style.display = 'block';

    $("#log_list_search").keyup(updateTimeChart);

    new ClipboardJS('.copyToClipboardBtn', {
        text: function(trigger){
            return trigger.nextElementSibling.innerText;
        }
    });
}

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

// not present - called from chunking to build the graph
function createChartFromLogdata(){

    // Get data range
    var firstDate = _(logdata).min('dateObj').dateObj;
    var lastDate = _(logdata).max('dateObj').dateObj;

    // Create Chart with this data
    createChart(
        logdata,
        firstDate,
        lastDate,
        $("#global_time_scale"),
        $("#globalChart"),
        $("#global_chart_queries_count"),
        'globalGroupedTimescaleData',
        'displayedGlobalChart'
    );
};

// different (much bigger) - create global (and working chart)
function createChart(data, firstDate, lastDate,
                     $timeScaleSelector, $targetChartCanvas, $queryCountContainer,
                     debugGroupedDataGlobalVariableName, chartGlobalVariableName) {
                        
    var initialArguments = arguments;    

    $timeScaleSelector.off('change');
    $timeScaleSelector.on('change', function(){
        // Re-calling create charts with same arguments
        createChart.apply(null, initialArguments);
    });

    var currentTimeScale = TIME_SCALES[$timeScaleSelector.val()];
    var NB_DISPLAYED_LABELS = 30;
    var timeScaleRanges = _(_.range(Math.floor((firstDate.getTime())/(currentTimeScale.numberOfMillis)), (lastDate.getTime())/(currentTimeScale.numberOfMillis))).map(function(index, itemsIndex, items) {
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
    }).value();

    window[debugGroupedDataGlobalVariableName] = _(data).map(function(data){
        return _.extend({}, data, {
            timeScaleIndex: _.findIndex(timeScaleRanges, function(range){ return range.matchesWith(data.dateObj); })
        });
    }).groupBy('timeScaleIndex').value();

    var countsPerTimeScaleIndex = _(window[debugGroupedDataGlobalVariableName]).mapValues('length').value();

    var datasets = [{
        label: "Nb requêtes",
        fillColor: "rgba(220,220,220,0.2)",
        strokeColor: "rgba(220,220,220,1)",
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

    $queryCountContainer.html("Displaying "+data.length+" queries");

    $chartCanvas.off('click');
    $chartCanvas.on('click', function(evt){
        var chartInfos = window[chartGlobalVariableName];
        var activePoints = chartInfos.chartComponent.getPointsAtEvent(evt);
        var medianPoint = activePoints[Math.floor(activePoints.length/2)];
        if(!medianPoint) {
            return;
        }

        var targetTimeScaleRange = chartInfos.timeScaleRanges[chartInfos.datasetIndexFromPointResolvers[0].indexFromPoint[medianPoint.x]];

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
        var filteredData = filterData(logdata, window.filteringCriteria);
        list.add(filteredData);

        // Create the working chart with filtered data
        createChart(
            filteredData,
            window.filteringCriteria.start?window.filteringCriteria.start.startingDate:firstDate,
            window.filteringCriteria.end?window.filteringCriteria.end.endingDate:lastDate,
            $("#working_time_scale"), $("#workingChart"), $("#working_chart_queries_count"),
            'workingGroupedTimescaleData', 'displayedWorkingChart');

        document.getElementById('working_chart_container').style.display = 'block';
    });

    document.getElementById('global_chart_container').style.display = 'block';
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

// not present
function filterData(data, criteria) {
    var filteredData = (criteria.start || criteria.end)?
        _.filter(data, function(item){
            if(criteria.start && !criteria.start.matchesWithLowBound(item.dateObj)) {
                return false;
            }
            if(criteria.end && !criteria.end.matchesWithHighBound(item.dateObj)) {
                return false;
            }
            return true;
        }):data;

    calculateQueryPatternOccurencesTextOn(filteredData);

    return filteredData;
}

// load the file as text and process
function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.

    // files is a FileList of File objects. List some properties.
    var output = [];
    var f = files[0];

    output.push('<strong>', f.name, '</strong> (', f.type || 'n/a', ') - ', f.size, ' bytes');
    document.getElementById('drop_result').innerHTML = '<h2>Loading ' + output.join('') + '</h2>';

    var reader = new FileReader();
    
    // Closure to capture the file information.
    reader.onloadend = function(e) {
        if (e.target.readyState == FileReader.DONE) {

            // send the text file to processing
            var len = processLog(e.target.result);

            //loadProgress.innerHTML = "Progress : 100%";

            var span = document.createElement('span');
            span.innerHTML = "Imported " + logdata.length + " entries.";
            document.getElementById('load_result').insertBefore(span, null);

            // Build the table / Change from file dropbox to data table
            createList();

            // Create the chart // Build and display the Chart
            try {
                createChartFromLogdata();
            } catch (error) {
                console.log(error);
            }
            
            // Update page to show imported
            var span = document.createElement('span');
            span.innerHTML = "Imported " + len + " entries.";
            document.getElementById('load_result').insertBefore(span, null);

        }
    };

    // Read in the image file as a data URL.
    reader.readAsText(f);

}

/* use this code to make a processing progress bar 
function donotuse(){
    document.getElementById('drop_result').innerHTML = '<h2>Loading ' + output.join('') + '</h2>';
    
    logdata = [];

    var loadProgress = document.getElementById('load_progress');

    var CHUNK_SIZE = 10*1000*1000;// Reading chunks of 10Mo
    var currentStartingBytesOffset = 0;
    var latestEntryText = "";


            // Is this the last chunk of the file
        if(latestChunk) {


            loadProgress.innerHTML = "Progress : 100%";

            var span = document.createElement('span');
            span.innerHTML = "Imported " + logdata.length + " entries.";
            document.getElementById('load_result').insertBefore(span, null);

            // Change from file dropbox to data table
            createList();

            // create the chart
            createChartFromLogdata();

        } else {
            loadProgress.innerHTML = "Progress : "+Math.round(currentStartingBytesOffset*100/f.size)+"%";

            latestEntryText = result.latestEntryText;
            currentStartingBytesOffset += CHUNK_SIZE;

            readFileChunk(f, currentStartingBytesOffset, currentStartingBytesOffset+CHUNK_SIZE).then(handleFileChunkRead);
        }
    };

    readFileChunk(f, 0, CHUNK_SIZE).then(handleFileChunkRead);
}*/

// orig
function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

// orig
function start() {
    // Setup the dnd listeners. (for when somene drops a file into the drop_xzone)
    var dropZone = document.getElementById('drop_zone');
    dropZone.addEventListener('dragover', handleDragOver, false);  // maybe this can be use to convert the background or hide a select file buttong
    dropZone.addEventListener('drop', handleFileSelect, false);  // this is triggered when you drag and drop a file
}

// orig
var logdata = [];
var timedata = [];
var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (var i = 0; i < 7; i++) {
    timedata[i] = {};
    timedata[i].dayName = dayNames[i];
}
var list;
