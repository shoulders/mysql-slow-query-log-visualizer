# mysql-slow-query-log-visualizer

I will be putting this online shortly so no need to roll your own

## Privacy Information

- The data never leaves your computer as processing is all handled in the browser (Client Side).
- To prove this, once you have loaded the page, disconnect from the internet before analysing your log.

## Getting the Slow Log file

- You need to make sure slow query logging is enabled and configured as required.
- On `Ubuntu` the file is located here: `/var/lib/mysql/slow-query.log`, some OS might have it here `/var/log/mysqld-slow.log`.

## Usage

> There is a demo log file called `demo_slow-query.log` in the GitHub Repo for testing with and is based on **MariaDB**.

- Upload your `slow-query.log` by dragging it in to the browser making sure you release it in to the dropzone.
  - If you need to load very large files, you will need to use Chrome, and launch it with the flags `--js-flags="--max-old-space-size=5000"` in order to
  allocate 5GB to chrome and avoid memory errors due to huge load of things in memory.
  - Another useful command if your file is large, is to `split`. Your can split your file into several files using this command : `split --bytes=512M --additional-suffix=.log slow-query.log`.
- A **Global Chart** of all of the queries plotted against time will now be displayed along with a **Query Table** showing the actual queries themselves.
  - You can change the timescale of the chart by using the dropdown option called **Group By**.
- Filter the results by clicking once on the chart to set a start time and again to set an end time.
  - This will now generate a second chart called **Working Chart** showing the filtered results.
  - The table of the queries is also filtered to reflect the results showing in the **Working Chart**.
  - You can now select the start and end time in either chart.
  - Not all chart types support filtering so the **Working Chart** and **Query Table** will not be present. The Aggregated graph types do not have a data drill down function (i.e. Workingchart) because of the nature of the data used.
  - If you choose an end date that is before your start date, then your start date will be used for both values.
  - If you double click a bar it will show only the results of that segment in the working chart.
  - While choosing your start time and end time, you can use mix and match using both charts to choose those times.
- Anaylyse the fitlered results further by using the search and sort by options available in the table of queries.
  - The Tables column headings allow you to sort by acending or descending
  - The queries in the table can be further filtered by using the **Filter** input box. This will not change the results shown in the Working Chart.
  - The queries in the table will always reflect the results in the Working Chart unless you have just intitally loaded the page.
  - You can copy the queries using the **Copy Button** for each query.
  - The filter will return any query that has the filter term in any of the columns (Visible Fields).

In the displayed queries, some columns may be of interest:

- **query string** : original query string executed, and being slow. Note that this query will display parameters
   as is, even if you used prepared statements
- **query with stripped where clauses** : some transformations are applied on origin query string in order
   to remove hardcoded values (in order to facilitate identification of same queries with different criteria values)
- **query pattern occurences** : Number of time `query with stripped where clauses` occurences are found
   First number is the number of occurences

## Notes

- The script:
  - Assumes your log file has `\n` line endings.
  - Uses local time and not time based on timestamps so the dates and times will be what you expect.
  - Has had extensive comments allowing easy reading of what the code does.
