"use strict";

var host = {
    QA: 'https://test-api.itigocloud.com',
    Prod: 'https://api.itigocloud.com'
};

function ItigoWDC () {
    this.getSchema = function (schemaCallback) {
        var connectionData = JSON.parse(tableau.connectionData || "{}");
        var tables = connectionData.tables;
        var selectedTables = connectionData.selectedTables;
        var tableSchemas = [];
        var table;
        var column;
        for (table in selectedTables) {
            var cols = [];
            var tableId = null;
            var tableAlias = null;
            for (column in selectedTables[table]) {
                var columnName = selectedTables[table][column];
                cols.push({
                    id: tables[table][columnName].columnId,
                    alias: tables[table][columnName].columnAlias,
                    dataType: tables[table][columnName].columnDataType
                });
                if (!tableId) {
                    tableId = tables[table][columnName].tableId;
                    tableAlias = tables[table][columnName].tableAlias;
                }
            }
            //if (tableId == 'Account' || tableId == 'User' || tableId == 'Account_Position')
            tableSchemas.push({
                id: tableId,
                alias: tableAlias,
                columns: cols
            });
        }

        schemaCallback(tableSchemas);
    };

    this.getData = function (table, doneCallback) {
        var successCallback = function (resp) {

            var businessObjectName = table.tableInfo.id;
            var options = {
                delimiter: ';',
                quoteChar: '"',
                header: true
            };
            var tableData = Papa.parse(resp, options).data;
            tableData.pop();
            tableau.reportProgress('Appending Data for ' + businessObjectName);
            table.appendRows(tableData);
            doneCallback();
        };

        var errorCallback = function (resp) {
            var tableData = [];
            table.appendRows(tableData);
            tableau.abortWithError('Error getting job batch data');
            doneCallback();
        };
        var connectionData = JSON.parse(tableau.connectionData || "{}");
        var createJobUrl = host[connectionData.environment] + '/bulk/v005/jobs';
        var auth = tableau.password;
        var businessObjectName = table.tableInfo.alias;
        var businessObjectAPIName = table.tableInfo.id;
        var jobId = null;
        var jobStatus = null;
        var jobBatchId = null;

        // create job
        tableau.reportProgress('Creating Bulk Data Load Job for ' + businessObjectName);
        var body = {
            Business_Object_Name: businessObjectName,
            Operation: 'Query',
            Content_Type: 'CSV',
            Record_Type: 'API Export',
            Query_Select: buildBulkQuery(table, businessObjectAPIName),
            CSV_Delimiter: 'Semicolon',
            CSV_Text_Qualifier: 'Double Quotes',
            Status: 'Closed'
        };

        $.ajax({
            url: createJobUrl,
            type: "POST",
            headers: {
                'Authorization': 'Basic ' + auth
            },
            data: body,
            async: false,
            dataType: 'json',
            success: function (resp) {
                jobId = getNestedObject(resp, ['RequestResponse', 'Id']) || null;
            },
            error: function (resp) {
                tableau.abortWithError('Error creating job');
            }
        })

        function checkJobStatus() {
            if (!jobId) {
                tableau.abortWithError('Error checking job status. No jobId.');
            }
            var checkJobBatchStatusUrl = host[connectionData.environment] + '/bulk/v005/jobs/' + jobId;
            tableau.reportProgress('Checking Job Status for ' + businessObjectName);
            $.ajax({
                url: checkJobBatchStatusUrl,
                type: "GET",
                headers: {
                    'Authorization': 'Basic ' + auth
                },
                async: false,
                dataType: 'json',
                success: function (resp) {
                    jobStatus = getNestedObject(resp, ['RequestResponse', 'Status__raw']) || null;
                },
                error: function (resp) {
                    tableau.abortWithError('Error checking job status');
                },
                complete: function (resp) {
                    if (jobStatus === 'Completed') {
                        getJobBatchId();
                    } else if (jobStatus === 'Failed') {
                        tableau.abortWithError('Job for ' + businessObjectName + ' Failed. JobId: ' + jobId);
                    } else {
                        setTimeout(checkJobStatus, 5000);
                    }
                }
            });
        }

        function getJobBatchId(retriesLeft) {
            var getJobBatchIdUrl = host[connectionData.environment] + '/bulk/v005/jobs/' + jobId + '/jobBatches';
            $.ajax({
                url: getJobBatchIdUrl,
                type: "GET",
                headers: {
                    'Authorization': 'Basic ' + auth
                },
                async: false,
                dataType: 'json',
                success: function (resp) {
                    jobBatchId = getNestedObject(resp, ['RequestResponse', 0, 'Id']) || null;
                },
                error: function (resp) {
                    tableau.abortWithError('Error getting job batch id');
                },
                complete: function (resp) {
                    if (jobBatchId) {
                        getJobBatchData();
                    } else {
                        table.appendRows([]);
                        doneCallback();
                    }
                }
            });
        }

        function getJobBatchData() {
            tableau.reportProgress('Getting Data for ' + businessObjectName);
            debugger;
            var getJobBatchDataUrl = host[connectionData.environment] + '/bulk/v005/jobBatches/' + jobBatchId + '/download';
            $.ajax({
                url: getJobBatchDataUrl,
                type: "GET",
                headers: {
                    'Authorization': 'Basic ' + auth
                },
                async: false,
                responseType: 'text',
                success: successCallback,
                error: errorCallback
            });

        }


        // initial call
        setTimeout(checkJobStatus, 500);
    };


    /**
     * Implements Tableau WDC shutdown().
     *
     * @param cb
     */
    this.shutdown = function(cb) {
        // Clear cache
        this._cache = {};
        cb();
    }

    /**
     * Implements Tableau WDC init().gulp
     *
     * @param {function} [cb]
     *  Callback function.
     */
    this.init = function (cb){
        //$(document).trigger('updateUI', hasAccessToken);

        cb();
    }



    function buildBulkQuery(table, businessObjectName) {
        var cols = [];
        var column;

        for (column in table.tableInfo.columns) {
            cols.push(table.tableInfo.columns[column].id);
        }

        return '[' + cols.join('],[') + ']';
    }

    function getNestedObject(nestedObj, pathArr) {
        return pathArr.reduce(
            function (obj, key) {
                return ((obj && obj[key] !== 'undefined') ? obj[key] : undefined);
            },
            nestedObj);
    }

}