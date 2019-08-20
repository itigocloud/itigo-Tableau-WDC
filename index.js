"use strict";

var wdc = new ItigoWDC();
tableau.registerConnector(wdc);

(function () {
	$(document).ready(function () {

		// Get the input field
		var inputUsername = document.getElementById("username");
		// Execute a function when the user releases a key on the keyboard
		inputUsername.addEventListener("keyup", function (event) {
			// Number 13 is the "Enter" key on the keyboard
			if (event.keyCode === 13) {
				// Cancel the default action, if needed
				event.preventDefault();
				// Trigger the button element with a click
				document.getElementById("loginButton").click();
			}
		});
		var inputPassword = document.getElementById("password");
		// Execute a function when the user releases a key on the keyboard
		inputPassword.addEventListener("keyup", function (event) {
			// Number 13 is the "Enter" key on the keyboard
			if (event.keyCode === 13) {
				// Cancel the default action, if needed
				event.preventDefault();
				// Trigger the button element with a click
				document.getElementById("loginButton").click();
			}
		});
		$("#loginButton").click(function () {
			var username = $('#username').val();
			var password = $('#password').val();
			var environment = $('#environment').val();

			tableau.password = btoa(username + ':' + password);
            var connectionData = JSON.parse(tableau.connectionData || "{}");
            connectionData.environment = environment;
            tableau.connectionData = JSON.stringify(connectionData);
			tableau.connectionName = "Itigo";
			//tableau.submit();

            var successCallback = function (resp) {
                var businessObjectSelection = $('#businessObjectSelection');
                var columnsSelection = $('#columnsSelection');
                var data = resp.queryResponse;
                var tables = {};
                var len = data.length;
                var i;
                for (i = 0; i < len; i += 1) {
                    if (data[i].API_Name === 'Max_Greatest_Updated') {
                        continue;
                    }
                    if (data[i].API_Name === 'Greatest_Updated') {
                        continue;
                    }
                    if (!tables[data[i].Business_Object_API_Name]) {
                        tables[data[i].Business_Object_API_Name] = {};
                    }
                    tables[data[i].Business_Object_API_Name][data[i].API_Name] = {
                        tableId: data[i].Business_Object_API_Name,
                        tableAlias: data[i].Business_Object_Name,
                        columnId: data[i].API_Name.replace('-', '_'),
                        columnAPIName: data[i].API_Name,
                        columnAlias: data[i].Name,
                        columnDataType: getTableauDataTypeEnum(data[i].Data_Type__raw),
                        columnDataTypeOriginal: data[i].Data_Type__raw
                    };
                }
                var connectionData = JSON.parse(tableau.connectionData || "{}");
                connectionData.tables = tables;
                tableau.connectionData = JSON.stringify(connectionData);
                var table;
                var column;
								var tablesOrdered = {};
								Object.keys(tables).sort().forEach(function(key) {
									tablesOrdered[key] = tables[key];
								});
                for (table in tablesOrdered) {
                    businessObjectSelection.append(new Option(table, table));
										var columnsOrdered = {};
										Object.keys(tablesOrdered[table]).sort().forEach(function(key) {
											columnsOrdered[key] = tablesOrdered[table][key];
										});
                    for (column in columnsOrdered) {
                        columnsSelection.append(new Option(table + '.' + tablesOrdered[table][column].columnAlias, table + '.' + column));
                    }
                }
                var dualListboxOptions = {
                    filterOnValues: true,
                    moveOnSelect: false,
                    nonSelectedListLabel: 'Available Columns',
                    selectedListLabel: 'Selected Columns',
                    infoText: false,
                    infoTextFiltered: false
                };
                columnsSelection.bootstrapDualListbox(dualListboxOptions);
                columnsSelection.bootstrapDualListbox('setNonSelectedFilter', '^' + businessObjectSelection.val() + '\\.', true);
								columnsSelection.bootstrapDualListbox('refresh');
                businessObjectSelection.change(function() {
                    columnsSelection.bootstrapDualListbox('setNonSelectedFilter', '^' + businessObjectSelection.val() + '\\.', true);
                    columnsSelection.bootstrapDualListbox('refresh');
                });
            };

            var errorCallback = function (resp) {
                tableau.abortWithError('Error in getSchema');
            };

            var query = 'SELECT Name, API_Name, Business_Object_Name, Business_Object_API_Name, Data_Type__raw FROM Field';

            executeRealtimeAPIQuery(query, successCallback, errorCallback);
            $(document).trigger('updateUI', true);
		});
        $("#submitButton").click(function () {

            var selection = $('#columnsSelection').val();
            var selectedTables = [];
            if(selection) {
                selectedTables = selection.reduce(function (result, current) {
                        var currentSelection = current.split('.');
                        if (!result[currentSelection[0]]) result[currentSelection[0]] = [];
                        result[currentSelection[0]].push(currentSelection[1]);
                        return result;
                    }
                    , {});
            }
            var connectionData = JSON.parse(tableau.connectionData || "{}");
            connectionData.selectedTables = selectedTables;
            tableau.connectionData = JSON.stringify(connectionData);

            tableau.submit();
        });
	});

    $(document).on('updateUI', function (e, isAuthenticated) {
        if (isAuthenticated) {
            $("#loginPanel").hide();
            $("#selectPanel").show();
        } else {
            $("#loginPanel").show();
            $("#selectPanel").hide();
        }
    });
})();

function executeRealtimeAPIQuery(query, successCallback, errorCallback) {
    if (!query) {
        errorCallback(null, null);
    }
    var connectionData = JSON.parse(tableau.connectionData || "{}");
    var apiCall = host[connectionData.environment] + "/realtime/v001/query?Max_Number_Of_Results=0&Query=" + query;
    var auth = tableau.password;

    $.ajax({
        url: apiCall,
        type: "GET",
        headers: {
            'Authorization': 'Basic ' + auth
        },
        async: false,
        dataType: 'json',
        success: function (resp) {
            successCallback(resp);
        },
        error: function (resp) {
            errorCallback(resp);
        }
    });
}

function getTableauDataTypeEnum(dataType) {
    switch (dataType) {
        case 'Date/Time':
            return tableau.dataTypeEnum.datetime;
        case 'Number':
        case 'Auto Number':
            return tableau.dataTypeEnum.float;
        case 'Date':
            return tableau.dataTypeEnum.date;
        default:
            return tableau.dataTypeEnum.string;
    }
}