mysql-slow-query-log-visualizer
----------

## Useful Information
- The data never leaves your computer as processing is all handled in the browser (Client Side).

## Usage :
- First, upload a mysql slow.log file (not that ATM, big files are not handled correctly)
  - If you need to load very large files, you will need to use Chrome, and launch it with the flags `--js-flags="--max-old-space-size=5000"` in order to
  allocate 5GB to chrome and avoid memory errors due to huge load of things in memory.
  - Another useful command if your file is large, is to `split`. Your can split your file into several files using this command : `split --bytes=512M --additional-suffix=.log slow-query.log`
- A timegraph of your queries will be displayed, with every queries displayed
- If you click points on the graph, you will limit the displayed queries with low/high time bounds
- In the displayed queries, some columns may be of interest :
  - **query string** : original query string executed, and being slow. Note that this query will display parameters
   as is, even if you used prepared statements
  - **query with stripped where clauses** : some transformations are applied on origin query string in order
   to remove hardcoded values (in order to facilitate identification of same queries with different criteria values)
  - **query pattern occurences** : Number of time `query with stripped where clauses` occurences are found
   First number is the number of occurences
