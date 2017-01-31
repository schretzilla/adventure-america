var app =  angular.module('myApp', []);
app.controller('myCtrl', ['$scope', '$document', '$window', function($scope, $document, $window){
	
	window.onload = function() {
		cachedScrollY = 0; //caches users scroll locations 
		loadCanvas();
	};

	

	function loadCanvas(){
		//Offsets for canvas center
		xOffset = 650;
		yOffset = -650;
		width = 2000, height = 2000;


		var svg = d3.select("#canvas").append("svg")
						.attr("width", width)
						.attr("height", height)
						.attr("id", "svg-ele");

		//SCALEMAX
		//SCALEMIN
		projection = d3.geoAlbersUsa()

		var path = d3.geoPath()
					.projection(projection);

		g = svg.append("g");

		//stores list of individual paths 
		pathObjArray = [];
		pointObjArray = [];
		orderedElementArray = []; //holds all ContentElementObject in order 

		d3.json("us_states_topo_simplified_20m.json", function(error, us){

			var gradient = svg
			.append("radialGradient")
				.attr("id", "gradient")
				.attr("x1", "0%")
				.attr("y1", "0%")
				.attr("x2", "100%")
				.attr("y2", "100%")
				.attr("spreadMethod", "pad");

			gradient.append("stop")
				.attr("offset", "0%")
				.attr("stop-color", "#47DF91")
				.attr("stop-opacity", .5);

			gradient.append("stop")
				.attr("offset", "100%")
				.attr("stop-color", "#47DFDD")
				.attr("stop-opacity", .1);

			g.append("path")
				.attr("class", "states")
				.datum(topojson.feature(us, us.objects.states))
				.attr("d", path)
				.style("fill", "url(#gradient)");


			//translate json place objects
			d3.json("places.json", function(places){
				
				//convert json objs to points
				//TODO: Add pivits back programaticly
				points = [];
				for(var i in places){
					//ignor pivit points
					// if(places[i].name != "Pivit"){
						places[i]["identifier"] = places[i].name.replace(".", "").replace(" ", "-"); //Add safe identifer 
						points.push(places[i]);
					// }
				}

				//add coordinates to map
				var circle = g.selectAll("circle")
								.data(points)
								.enter()
								.append("circle")
								.attr("cx", function (d) { return projection(coordinates(d))[0]; })
								.attr("cy", function (d) { return projection(coordinates(d))[1]; })
								.attr("r", "2px")
								.attr("fill", "blue")
								.attr("opacity", "0")
								.attr("id", function (d) { return d.identifier+"-pin"; });

				var text = g.selectAll("text")
								.data(points)
								.enter()
								.append("text")
								.attr("x", function(d) {return projection(coordinates(d))[0]; })
								.attr("y", function(d) { return projection(coordinates(d))[1]-3; })
								.style("text-anchor", "middle")
								.text( function(d) { return d.name})
								.attr("font-size", "8px")
								.attr("fill", "blue")
								.attr("opacity", "0")
								.attr("id", function (d) { return d.identifier+"-text"; } );

				//build linestring geofeatures
				var i=0, len=places.length-1;
				for(i=0; i<len; i++){
					links = [];

					var pivitAhead = false;
					links.push({
						type: "LineString",
						coordinates: [
							[ places[i].long, places[i].lat ],
							[ places[i+1].long, places[i+1].lat ]
						]
					});
						

					var arcPath = g.selectAll(".arcPath"+places[i].identifier)
						.data(links)
						.enter()
						.append("path")
						.attr("class","arcPath"+places[i].identifier) 
						.attr("d", path);

					var totalLength = arcPath.node().getTotalLength();

					//Append style to path
					arcPath.attr("fill", "none").attr("stroke", "red").attr("stroke-width", "1px");
					//Offset array
					arcPath
						.attr("stroke-dasharray", totalLength + " " + totalLength) //length of line, length of gap
						.attr("stroke-dashoffset", totalLength ); //where dasharray starts

					var startCircle = g.select("#"+points[i].identifier+"-pin");
					var startText = g.select("#"+points[i].identifier+"-text");
					var startPin = new LocationPin(startCircle, startText, points[i].long, points[i].lat);
					startPin.bringToFront(); //TODO: this is redundant most of the time maybe remove and only use on the first element

					var endCircle = g.select("#"+points[i+1].identifier+"-pin");
					var endText = g.select("#"+points[i+1].identifier+"-text");
					var endPin = new LocationPin(endCircle, endText, points[i+1].long, points[i+1].lat);
					endPin.bringToFront(); 

					//Store point obj in array
					var pointObj = new PointObject(startPin, pointObjArray.length); //TODO: this will cause issues on last pin edge case
					var pointElement = document.getElementById(points[i].identifier+"-Pt");
					var pointElementDimensions = new ContentElementObject(pointElement, pointObj, orderedElementArray.length);
					pointObjArray.push(pointObj);
					orderedElementArray.push(pointElementDimensions);

					//Build path's related content object
					var pathObj = new PathObject(arcPath, totalLength, pathObjArray.length, startPin, endPin, pathObjArray.length+1);
					var pathElement = document.getElementById(places[pointObj.orderNumber].identifier + "-" + places[pointObj.orderNumber+1].identifier + "-Path"); //TODO: rename content to name-name-path
					var pathElementDimensions =new ContentElementObject(pathElement, pathObj, orderedElementArray.length); 
					pathObjArray.push(pathObj);
					orderedElementArray.push(pathElementDimensions);
					
				}

				//Add Ending Point
				var startPin = pathObjArray[pathObjArray.length-1].endPin;
				var pointObj = new PointObject(startPin, pointObjArray.length); 
				var pointElement = document.getElementById(points[places.length-1].identifier+"-Pt");
				var pointElementDimensions = new ContentElementObject(pointElement, pointObj, orderedElementArray.length);
				pointObjArray.push(pointObj);
				orderedElementArray.push(pointElementDimensions);

				//add footer element
				var footerObj = new footerObject(pointObjArray[pointObjArray.length-1].pin);
				var footerElement = document.getElementById("footer");
				var footerElementDimensions = new ContentElementObject(footerElement, footerObj, orderedElementArray.length);
				orderedElementArray.push(footerElementDimensions);

				mapFrame = new MagnifyingGlass(g);
				loadPaths();
				document.addEventListener('scroll', scrollFunction );
				window.addEventListener('resize', screenResize );


			}); //End Places.json load

		}); //End states-topo load
	}


	//Content element object use for path's paired content
	function ContentElementObject(element, graffic, order){
		this.element = element;
		this.elementHeight = element.scrollHeight;
		this.bounds = element.getBoundingClientRect();
		//handles scroll offset by calculating scroll Y
		this.windowTop = $window.scrollY; //used to for calculating top and bottom elements
		this.top = this.bounds.top + this.windowTop;    
		this.bottom = this.bounds.bottom + this.windowTop;
		this.height = this.bottom - this.top;
		this.orderNumber = order; 
		this.graffic = graffic; //stores the canvas graffics (point or path) for this object
		this.percentComplete = function(windowTop){
			var clientHeight = window.innerHeight; 	//client window height
			var percentComplete = ( ( windowTop - this.top ) / this.height );
			return percentComplete;
		}
		//TODO: Figure out hierarchy so percent complete can be referenced by children objects
		this.scrollEffect = function(windowTop){
			if(this.graffic.isPath){
				this.graffic.updatePath(this.percentComplete(windowTop));
			} 
			//else {
			//     this.graffic.updatePoint(windowTop);
			// }
		}
		this.containsScreenAt = function(yPlacement) {
			return (yPlacement < this.bottom && yPlacement > this.top);
		}
		//update objs dimensions -> used on screen size changes
		this.updateDimensions = function(windowTop){
			this.elementHeight = element.scrollHeight;
			this.bounds = element.getBoundingClientRect();
			this.top = this.bounds.top + windowTop;
			this.bottom = this.bounds.bottom + windowTop;
			this.height = this.bottom - this.top;			
		}

	}

	function footerObject(pin){
		this.type = "footer";
		this.pin = pin;
		this.isPath = false;
		this.isPoint = false;

		this.setFocus = function() {
			mapFrame.zoomOut(1);
		}
		this.updatePoint = function(windowTop) {
			null;
		}
		this.completeEffect = function(){
			null;
		}
		this.emptyEffect = function(){
			var focalPoint = projection([this.pin.long, this.pin.lat]) 
			focalPoint = { x: focalPoint[0], y: focalPoint[1] };
			mapFrame.zoomTo(focalPoint, 6);
		}
	}
	//TODO: can do some type of hierarchy with point and path objects
	//A point object coupled with its content
	function PointObject(pin, order){
		this.type = "point";
		this.pin = pin;
		this.isPath = false;
		this.isPoint = true;
		this.orderNumber = order;   //TODO: Check if we need this field
		//this.contentDimensions = contentObj;
		this.setFocus = function(){
			this.pin.show();
		}
		this.updatePoint = function(windowTop) {
			// if(!this.pin.visible){
			//     this.pin.show();
			// }              
			null;          
		}
		this.completeEffect = function(){
			if(!this.pin.visible){
				this.pin.show();
			}
		}
		this.emptyEffect = function(){
			this.pin.dissapear();
		}
	}

	//A path object coupled with its content 
	function PathObject(path, length, pathNumber, startPin, endPin, order){
		//TODO: Add start coords and end coords
		this.type = "path";
		this.isPath = true;
		this.isPoint = false;
		this.path = path;
		this.length = length;
		//this.contentDimensions = contentObj;
		this.pathNumber = pathNumber; //order number of path
		this.startPin = startPin;
		this.endPin = endPin; 
		this.orderNumber = order;   //todo, check if we need this field
		// this.scrollEffect = function(percentComplete) {
		//     this.updatePath(percentComplete);
		// }
		this.setFocus = function(){
			null;
		}
		this.completeEffect = function(){
			this.fillPath();
		}
		this.emptyEffect = function(){
			this.emptyPath();
		}
		//update path on change
		this.updatePath = function(percentComplete) {
			var dashoffset = this.length - ( this.length * percentComplete );

			this.path
			.attr("stroke-dashoffset", dashoffset ); //where dasharray starts

			//Pan features 
			this.panToPath(this.length - dashoffset);

		}
		this.panToPath = function(visiblePathLength){
			//get coordinates at current path length
			var curPoint = this.path.node().getPointAtLength(visiblePathLength);
			mapFrame.setView(curPoint, 6);
		}

		this.fillPath = function(){
			this.path
			.attr("stroke-dashoffset", 0 ); 
			//show pin
			this.endPin.show();
		}
		this.emptyPath = function(){
			this.path
			.attr("stroke-dashoffset", this.length);
			//this.startPin.dissapear();
		}
	}

	//Groups locations by the circle and text that builds them
	function LocationPin(circle, text, longitude, latitude){
		this.circle = circle;
		this.text = text;
		this.long = longitude;
		this.lat = latitude;
		this.visible = false; 

		this.show = function(){
			this.circle
						.transition()
						.duration(1000)
						.attr("opacity", "1")

			this.text
						.transition()
						.duration(1000)
						.attr("opacity", "1");

			this.visible = true;
		}
		this.dissapear = function(){
			this.circle
						.transition()
						.duration(1000)
						.attr("opacity", "0");
			this.text
						.transition()
						.duration(1000)
						.attr("opacity", "0");

			this.visible = false;
		}
		this.bringToFront = function(){
			this.circle.each(function(){
				this.parentNode.appendChild(this);
			})
			this.text.each(function(){
				this.parentNode.appendChild(this);
			})
		}

	}

	//An object that allows zoom and pan features for a group
	function MagnifyingGlass(group){
		this.group = group;

		this.zoomTo = function(location, scale, duration=3000){
			this.group
				.transition()
				.duration(duration)
				.attr("transform", this.transform(location, scale));
		}

		this.zoomOut = function(scale, duration=3000){
			this.group
					.transition()
					.duration(duration)
					.attr("transform", this.transformStrBuilder(950, 0, scale))
		}

		this.setView = function(point, scale){
			this.group
				.transition()
				.attr("transform", this.transform(point, scale));
		}

		this.transform = function(point, scale) {
			//TODO: Confirm calculations
			var px = width/2 - point.x * scale;
			var py = height/2 - point.y * scale;
			return this.transformStrBuilder(px+xOffset, py+yOffset, scale);
		}

		this.transformStrBuilder = function(px, py, scale){
			return "translate("+px+","+py+")scale("+scale+")";
		}
	}

	//Helper function convert json point to coordinates
	function coordinates(point){
		return [point.long, point.lat];
	}

	//OnLoad load path by location
	function loadPaths(){
		var windowTop = $window.scrollY;
		cachedScrollY = windowTop;

		//Determin if user is in header teritory
		if(windowTop < orderedElementArray[0].top){
			//TODO: add position absolute CSS to header image here
				currentElement = null;
				canvasUnStick(windowTop);
				mapFrame.zoomOut(1);
		} else {
			//determin what path the user's scroll is at
			canvasStick();
			for(i=0; i<orderedElementArray.length; i++){
				if ( orderedElementArray[i].top <= windowTop && orderedElementArray[i].bottom >= windowTop ){
					currentElement = orderedElementArray[i];
					currentElement.scrollEffect(windowTop); //TODO: add graffic class to this
					if(currentElement.graffic.isPoint){
						//TODO: make function for converting this
						var focalPoint = projection([currentElement.graffic.pin.long, currentElement.graffic.pin.lat]) 
						focalPoint = { x: focalPoint[0], y: focalPoint[1] };
						mapFrame.zoomTo(focalPoint, 6);
					}
					break;
				} else {
					currentElement = orderedElementArray[i];
					orderedElementArray[i].graffic.completeEffect(); 	//Fill path if passed
				}
			}
		}
	}

	function canvasStick(){
		var canvasStyle = document.getElementById("canvas").style;
		canvasStyle.top = "0";
		canvasStyle.position = "fixed";
		currentElement = orderedElementArray[0]; //TODO: this will change when you add headers and footers to this array
	}

	function canvasUnStick(windowTop){
		var canvasStyle = document.getElementById("canvas").style;
		headerBounds = document.getElementById("header-img-div").getBoundingClientRect();
		canvasStyle.top = headerBounds.bottom+windowTop+"px";
		canvasStyle.position = "absolute";
	}

	//  var debouncedScroll = _.throttle(, 0);

	var screenResize = function() {
		var len=orderedElementArray.length-1;
		var orderElem;
		var windowTop = $window.scrollY;
		do{
			orderElem = orderedElementArray[len];
			orderElem.updateDimensions(windowTop);
			len--;
		}while(len);
		//calculateOffsets();
		scrollFunction();
	}
	/*
	* called on large page jumps to redrawl lines as needed
	*/
	function pageRedrawl(windowTop) {
		var len=orderedElementArray.length-1;
		var orderElem;
		var foundPlacement = false;
		do{
			orderElem = orderedElementArray[len];
			if( !orderElem.containsScreenAt(windowTop)) {
				orderElem.graffic.emptyEffect();
			}
			else {
				//Found element
				currentElement = orderElem; 
				//TODO: clean this up and test
				if(currentElement.graffic.isPath){
					currentElement.scrollEffect(windowTop);
				}else {					
					//TODO: make function for 3 use cases
					var focalPoint = projection([currentElement.graffic.pin.long, currentElement.graffic.pin.lat]) 
					focalPoint = { x: focalPoint[0], y: focalPoint[1] };
					mapFrame.setView(focalPoint, 6);
				}
				len--;
				break;
			}
			len--;
		}while(len);
		
		//Fill remainder of graffics
		while(len){
			orderElem = orderedElementArray[len];
			orderElem.graffic.completeEffect();
			len--;
		}
	}
	var scrollFunction = function() {
		//TODO: add pixles to window top so its offset fromt he very top of the page
		var windowTop = $window.scrollY;

		//Catch fast page jumps
		if (windowTop+1000 < cachedScrollY || windowTop - 1000 > cachedScrollY){
			pageRedrawl(windowTop);
		}
		else{
		// if (windowTop+buffer < cachedScrollY || windowTop-buffer > cachedScrollY ){
			//determin current path by scrollY
			//TODO: better way to handle current path than null
			if(windowTop < orderedElementArray[0].top ){
				//in header teritory

				if( currentElement != null ){
					canvasUnStick(windowTop);
					currentElement = null;

					mapFrame.zoomOut(1);
				}

			}
			else if( currentElement === null && windowTop > orderedElementArray[0].top) {
				//broke free from header
				canvasStick();
				
				//Zoom to starting point
				var startingPoint = pathObjArray[0].path.node().getPointAtLength(0);
				mapFrame.zoomTo(startingPoint, 6);
				pathObjArray[0].startPin.show();
			}
			else {
				//Inside path content
				if(windowTop > currentElement.bottom){
					//passed bottom
					currentElement.graffic.completeEffect();
					currentElement = orderedElementArray[currentElement.orderNumber+1];
					currentElement.graffic.setFocus();
				} else if(windowTop < currentElement.top){
					//above top
					currentElement.graffic.emptyEffect();
					currentElement = orderedElementArray[currentElement.orderNumber-1];
					currentElement.graffic.setFocus();
				}
				
				currentElement.scrollEffect(windowTop);  //TODO: add graffic class 
			}
		}//End large y jump condition
		cachedScrollY = windowTop;

	}

}]);