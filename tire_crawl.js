var mysql = require('mysql');
var request = require('request');
var unique = require('array-unique'); //used to unique an array //unique(['a', 'b', 'c', 'c']);
var dateformatl = require('date-format-lite');

var connection = mysql.createConnection(
    {
      host     : 'localhost',
      user     : 'root',
      password : 'root',
      database : 'ct',
    }
);

connection.connect();	

var base_url = 'http://tireselector.conti-online.com/service/json';



function loadAndParseURL(url, callback) {
	var options = {
		url : url //url we are loading		
	};
	var req = request(options, function(error, response, body) {	
		if (!error && response.statusCode == 200) {						
			return callback(JSON.parse(body));
		} else {
			return callback(null);
		}
	});	
}

var counter = 0;
function iscomplete() {
	counter--;
	if (counter <= 0) {
		complete();
	}
}
function findVehicle(year, make_id, model_id, callback) {
	if (year == null) {
		var response = loadAndParseURL(base_url, function(response) {			
			for(var i = 0;i<response['years'].length;i++) {
				counter++;
				findVehicle(response['years'][i], null, null, iscomplete);
			}			
		});		
	} else if (make_id == null) {
		console.log("Finding Vehicle ID for year " + year);
		var response = loadAndParseURL(base_url+'?year='+year, function(response) {			
			for (var key in response['makes']) {
				counter++;
				findVehicle(year, key, null, iscomplete);
			}
			return callback();
		});	
	} else if (model_id == null) {		
		console.log("Finding Vehicle ID for year " + year + " and make " + make_id);		
		var response = loadAndParseURL(base_url+'?year='+year+'&make_id='+make_id, function(response) {			
			for (var key in response['models']) {
				counter++;
				findVehicle(year, make_id, key, iscomplete);
			}
			return callback();
		});	
	} else {
		//we have all 3, we can actually find the vehicle_ids
		console.log("Finding Vehicle ID for year " + year + " and make " + make_id + " and model " + model_id);		
		var response = loadAndParseURL(base_url+'?year='+year+'&make_id='+make_id+'&model_id='+model_id, function(response) {			
			for (var key in response['vehicles']) {
				counter++;
				var query = connection.query ("INSERT INTO vehicles set vehicle_id = ?", key, function(err,rows, fields) {
					iscomplete();
				});
			}
			return callback(); //calls iscomplete for nested loops
		});	
	}
}

//uncomment to populate the vehicle table with the id's
//findVehicle(); 


var query = connection.query("SELECT vehicle_id FROM vehicles", function(err, rows, fields) {	
	for (var i in rows) {		
		counter++;
		findProducts(rows[i].vehicle_id, sortproducts);
	}
});

function sortproducts() {	
	unique(product_names);
	if ((counter % 100) == 0) {
		console.log('sortproducts counting down:' + counter);
		console.log(product_names);
	}
	counter--;
	if (counter <= 0) {
		console.log(product_names);
		for(var i = 0;i<product_names.length;i++) {
			console.log(product_names[i]);
		}
		complete();
	}
}

var product_names = new Array();

function findProducts(vehicle_id, callback) {
	var response = loadAndParseURL(base_url+'?vehicle_id=' + vehicle_id + '&plus_size=all', function(response) {			
		if (response.hasOwnProperty('vehicle_info')) {
			for (var key in response['vehicle_info']) {			
				if (response['vehicle_info'][key].hasOwnProperty('replacements')) {
					//console.log(response['vehicle_info'][key]['replacements']);
					if (response['vehicle_info'][key]['replacements'].length > 0) {
						for(var i = 0;i<response['vehicle_info'][key]['replacements'].length;i++) {
							for(var j = 0;j<response['vehicle_info'][key]['replacements'][i]['tires'].length;j++ ) {
								product_names.push(response['vehicle_info'][key]['replacements'][i]['tires'][j]['product_name']);
							}
							//check to see if the product is in the DB
								//it is, then insert a record into vehicleproducts to log this association
							//its not!
								//then insert into the product table, and insert into vehicleproducts
						}
					}		
				}
			}
		}
		return callback();	
	});
}

function complete() {
	connection.end(); //close the mysql connection
	console.log('Done');
}