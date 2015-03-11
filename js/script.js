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

function processLog (logtextChunk, isLatestChunk) {
    var log_entry;
    var log_lines;
    var date_string;
    var entry_stats;
    
    var logdataAsText = logtextChunk.split("# User@Host: ");
    logdataAsText.shift();

    var logdata = [];
    for (var i = 0; i < logdataAsText.length-(isLatestChunk?0:1); i++) {
        
        // load string
        
        log_entry = logdataAsText[i];
        log_lines = log_entry.split("\n");

        entry_stats = log_lines[1].split(" ");

        logdata[i] = {
            // get host
            db_name: log_lines[0].split("[")[1].split("]")[0],
            // get stats
            query_time: entry_stats[2], // query time
            lock_time: entry_stats[5], // lock time
            rows_sent: entry_stats[7], // rows sent
            rows_examined: entry_stats[10] // row examined
        };

        if (log_lines[2].substr(0,3) == "use") {
            log_lines.shift(); 
        }
        date_string = log_lines[2].split("SET timestamp=")[1].split(";")[0];
        
        // parse date
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
        
        date_string = year + "/" + month + "/" + day + " " + hours + ":" + mins;
        
        logdata[i].dateObj = d; // date
        logdata[i].date = date_string;
        logdata[i].hour = hours;
        
        // isolate query
        
        log_lines.shift();
        log_lines.shift();
        log_lines.shift();
        
        logdata[i].query_string = log_lines.join("\n").split("# Time: ")[0]; // query
        logdata[i].query_with_stripped_where_clauses = stripWhereClauses(logdata[i].query_string);
        
        // time stats
        
        if (timedata[dayOfWeek][hours] == null) {
            timedata[dayOfWeek][hours] = 0;
        }
        
        timedata[dayOfWeek][hours]++;
    }

    var dataGroupedByStrippedQueries = _.groupBy(logdata, 'query_with_stripped_where_clauses');
    var hideShowButtons = '<a class="showBtn" onclick="showQuery(this);">Show</a><a class="hideBtn" onclick="hideQuery(this);" style="display:none">Hide</a>';
    _.each(logdata, function(data) {
        data.query_string = hideShowButtons+'<span style="display:none"><br/>'+data.query_string+'</span>';
        data.displayed_query_with_stripped_where_clauses = hideShowButtons+'<span style="display:none"><br/>'+data.query_with_stripped_where_clauses+'</span>';
        data.query_pattern_global_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;
    });
    calculateQueryPatternOccurencesTextOn(logdata);

    return {
        logdata: logdata,
        latestEntryText: isLatestChunk?null:logdataAsText[logdataAsText.length-1]
    };
    return logdata.length;
}

function calculateQueryPatternOccurencesTextOn(dataItems) {
    var dataGroupedByStrippedQueries = _.groupBy(dataItems, 'query_with_stripped_where_clauses');
    _.each(dataItems, function(data) {
        data.query_pattern_filtered_occurences = dataGroupedByStrippedQueries[data.query_with_stripped_where_clauses].length;
    });
}

function showQuery(node) {
    $(node).siblings('span').show();
    $(node).siblings('.hideBtn').show();
    $(node).hide();
}

function hideQuery(node) {
    $(node).siblings('span').hide();
    $(node).hide();
    $(node).siblings('.showBtn').show();
}

function stripWhereClauses(query) {
    var indexOfWhere = query.toUpperCase().lastIndexOf("WHERE");
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

    return initialRadical + chunkToReplace;
}

function createList ()
{
    var options = {
        item: 'log_list_item',
        maxVisibleItemsCount: 3000
    };
    
    list = new List('log_list', options, logdata);
    
    document.getElementById('drop_zone').style.display = 'none';
    document.getElementById('log_list').style.display = 'table';

    document.getElementById('query_results').style.display = 'block';

    $("#log_list_search").keyup(updateTimeChart);
}

var TIME_SCALES = {
    hourly: {
        numberOfMillis: 3600*1000,
        format: function(date){ return _.padLeft(date.getDate(), 2, "0")+"/"+ _.padLeft(date.getMonth()+1, 2, "0")+" "+ _.padLeft(date.getHours(), 2, "0")+"h"; }

    }, daily: {
        numberOfMillis: 3600*1000*24,
        format: function(date){ return _.padLeft(date.getDate(), 2, "0")+"/"+ _.padLeft(date.getMonth()+1, 2, "0"); }

    }, weekly: {
        numberOfMillis: 3600*1000*24*7,
        format: function(date){ return _.padLeft(date.getDate(), 2, "0")+"/"+ _.padLeft(date.getMonth()+1, 2, "0"); }

    }
};

function createChartFromLogdata(){
    var firstDate = _(logdata).min('dateObj').dateObj;
    var lastDate = _(logdata).max('dateObj').dateObj;

    createChart(firstDate, lastDate, $("#global_time_scale"), $("#globalChart"), 'globalGroupedTimescaleData', 'displayedGlobalChart');
};

function createChart(firstDate, lastDate, $timeScaleSelector, $targetChartCanvas, globalDebugGroupedDataName, globalChartVariableName) {
    $timeScaleSelector.off('change');
    $timeScaleSelector.on('change', function(){
        createChart(firstDate, lastDate, $timeScaleSelector);
    });

    var currentTimeScale = TIME_SCALES[$timeScaleSelector.val()];
    var timeScaleRanges = _(_.range(Math.floor((firstDate.getTime())/(currentTimeScale.numberOfMillis)), (lastDate.getTime())/(currentTimeScale.numberOfMillis))).map(function(index) {
        var startingDate = new Date(index*currentTimeScale.numberOfMillis), endingDate = new Date((index+1)*currentTimeScale.numberOfMillis);
        var label = currentTimeScale.format(startingDate);
        return {
            startingDate: startingDate,
            endingDate: endingDate,
            label: label,
            matchesWithLowBound: function(date) { return startingDate.getTime()<=date.getTime(); },
            matchesWithHighBound: function(date) { return endingDate.getTime()>date.getTime(); },
            matchesWith: function(date) { return this.matchesWithLowBound(date) && this.matchesWithHighBound(date); }
        };
    }).value();

    window[globalDebugGroupedDataName] = _(logdata).map(function(data){
        return _.extend({}, data, {
            timeScaleIndex: _.findIndex(timeScaleRanges, function(range){ return range.matchesWith(data.dateObj); })
        });
    }).groupBy('timeScaleIndex').value();

    var countsPerTimeScaleIndex = _(window[globalDebugGroupedDataName]).mapValues('length').value();

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
    if(window[globalChartVariableName]){
        window[globalChartVariableName].destroy();
    }
    window[globalChartVariableName] = new Chart(ctx).Line({
        labels: _.pluck(timeScaleRanges, "label"),
        datasets: datasets
    }, {
        pointHitDetectionRadius: 1
    });
    // Hack to be able to retrieve index from x coordinate
    var datasetIndexFromPointResolvers = _.map(window[globalChartVariableName].datasets, function(dataset) {
        return {
            indexFromPoint: _(dataset.points).pluck('x').invert().value()
        };
    });

    $chartCanvas.click(function(evt){
        var activePoints = window[globalChartVariableName].getPointsAtEvent(evt);
        var medianPoint = activePoints[Math.floor(activePoints.length/2)];
        var targetTimeScaleRange = timeScaleRanges[datasetIndexFromPointResolvers[0].indexFromPoint[medianPoint.x]];

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
        list.add(filterData(logdata, window.filteringCriteria));
    });

    document.getElementById('global_chart_container').style.display = 'block';
}

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

function filterData(data, criteria) {
    var filteredData = (window.filteringCriteria.start || window.filteringCriteria.end)?
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

function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.

    // files is a FileList of File objects. List some properties.
    var output = [];
    var f = files[0];

    output.push('<strong>', f.name, '</strong> (', f.type || 'n/a', ') - ', f.size, ' bytes');
    document.getElementById('drop_result').innerHTML = '<h2>Loading ' + output.join('') + '</h2>';

    logdata = [];

    var loadProgress = document.getElementById('load_progress');

    var CHUNK_SIZE = 10*1000*1000;// Reading chunks of 10Mo
    var currentStartingBytesOffset = 0;
    var latestEntryText = "";
    var handleFileChunkRead = function(textRead) {
        var latestChunk = currentStartingBytesOffset+CHUNK_SIZE > f.size;
        var result = processLog(latestEntryText+textRead, latestChunk);

        Array.prototype.push.apply(logdata, result.logdata);

        if(latestChunk) {
            loadProgress.innerHTML = "Progress : 100%";

            var span = document.createElement('span');
            span.innerHTML = "Imported " + logdata.length + " entries.";
            document.getElementById('load_result').insertBefore(span, null);

            createList();
            createChartFromLogdata();
        } else {
            loadProgress.innerHTML = "Progress : "+Math.round(currentStartingBytesOffset*100/f.size)+"%";

            latestEntryText = result.latestEntryText;
            currentStartingBytesOffset += CHUNK_SIZE;

            readFileChunk(f, currentStartingBytesOffset, currentStartingBytesOffset+CHUNK_SIZE).then(handleFileChunkRead);
        }
    };

    readFileChunk(f, 0, CHUNK_SIZE).then(handleFileChunkRead);
}

function readFileChunk(file, startingBytes, endingBytes) {
    var defer = Q.defer();

    var reader = new FileReader();

    reader.onerror = function(e){
        switch(e.target.error.code) {
          case e.target.error.NOT_FOUND_ERR:
            alert('File Not Found!');
            break;
          case e.target.error.NOT_READABLE_ERR:
            alert('File is not readable');
            break;
          case e.target.error.ABORT_ERR:
            break; // noop
          default:
            alert('An error occurred reading this file.');
        };
    };
    reader.onloadend = function(e) {
        if (e.target.readyState == FileReader.DONE) {
            defer.resolve(e.target.result);
        }
    };

    var blobRead = _.isUndefined(startingBytes)?file:file.slice(startingBytes, endingBytes);
    reader.readAsText(blobRead);

    return defer.promise;
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function start() {
    // Setup the dnd listeners.
    var dropZone = document.getElementById('drop_zone');
    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleFileSelect, false);
}

var logdata = [];
var timedata = [];
var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (var i = 0; i < 7; i++) {
    timedata[i] = {};
    timedata[i].dayName = dayNames[i];
}
var list;