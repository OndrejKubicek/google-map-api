/**
 * Copyright (c) 2015 Petr Olišar (http://olisar.eu)
 *
 * For the full copyright and license information, please view
 * the file LICENSE.md that was distributed with this source code.
 */

var GoogleMap = GoogleMap || {};

GoogleMap = function(element)
{
    this.element = element;
    this.map;
    this.directionsDisplay;
    this.directionsService;
    this.markers = [];
    this.geocodeMarker = null;
    this.markerIcon = '';
    this.options = {};
    this.basePath;
    this.boundsProperty;
    this.markersCluster = new Array();
    this.URL = "";
    this.allowColors = new Array('green', 'purple', 'yellow', 'blue', 'orange', 'red');
    this.markerEvents;


    this.init();
};

GoogleMap.prototype = {

    constructor: GoogleMap,

    init: function()
    {
        this.setProperties();
        return this;
    },

    setProperties: function()
    {
        var properties = JSON.parse(this.element.dataset.map);

        this.options.position = properties.position;
        this.options.proportions = [properties.width, properties.height];
        this.options.zoom = properties.zoom;
        this.options.type = properties.type;
        this.options.scrollable = properties.scrollable;
        this.options.key = properties.key;
        this.options.bound = properties.bound;
        this.options.cluster = properties.cluster;
        this.options.clusterOptions = properties.clusterOptions;
        this.options.waypoints = properties.waypoint;
        this.basePath = this.element.dataset.basepath;
        this.URL = this.element.dataset.markersfallback;
        this.options.geocode = properties.geocode;
        this.options.useSearch = properties.useSearch;

        // Id of hidden input for inserting result of search
        this.options.searchCoordinatesInput = "selected_location";

        // Id of Google Map searchBox
        this.options.searchBoxInput = "autocomplete_input";

        return this;
    },

    initialize: function()
    {
        var base = this;

        base.doBounds('init');

        var mapOptions = {
            center: new google.maps.LatLng(base.options.position[0], base.options.position[1]),
            zoom: base.options.zoom,
            mapTypeId: google.maps.MapTypeId[base.options.type],
            scrollwheel: base.options.scrollable
        };

        base.markerIcon = "https://"+window.location.hostname+"/images/google_map/map_pin.png";

        // Display a map on the page
        base.map = new google.maps.Map(base.element, mapOptions);
        base.map.setTilt(45);
        base.loadMarkers();

        if (base.options.geocode !== null)
        {
            base.doGeocode();
        }

        if (base.options.waypoints !== null)
        {
            base.drawDirections();
        }

        if (base.options.useSearch)
        {
            base.searchCoordinatesInput = document.getElementById(base.options.searchCoordinatesInput);
            base.initAutocomplete();
        }
    },

    initAutocomplete: function() {
        var base = this;
        var options = {
            types: ['geocode']
        };
        var input = document.getElementById(this.options.searchBoxInput);

        // disable whole form submit on enter
        input.onkeypress = function(e) {
            return e.keyCode != 13;
        };
        var autocomplete = new google.maps.places.Autocomplete(input, options);

        base.onAutocompletePlaceChange(autocomplete);
    },

    onAutocompletePlaceChange: function (autocomplete) {
        var base = this;
        var marker = null;

        base.map.addListener('bounds_changed', function() {
            autocomplete.setBounds(base.map.getBounds());
        });

        // Listen for the event fired when the user selects a prediction and retrieve
        // more details for that place.

        autocomplete.addListener('place_changed', function() {
            var place = autocomplete.getPlace();

            // Clear out the old markers.
            //searchMarkers.forEach(function(marker) {
            if (marker !== null)
                marker.setMap(null);
            //});
            marker = null;

            // For each place, get the icon, name and location.
            var bounds = new google.maps.LatLngBounds();

            if (!place.geometry) {
                console.log("Returned place contains no geometry");
                return;
            }

            base.searchCoordinatesInput.value = place.geometry.location.lat()+';'+place.geometry.location.lng();

            if (base.geocodeMarker !== null) {
                base.geocodeMarker.setMap(null);
                base.geocodeMarker = null;
            }

            // Create a marker for each place.
            //searchMarkers.push(new google.maps.Marker({
            marker = new google.maps.Marker({
                map: base.map,
                icon: base.markerIcon,
                title: place.name,
                position: place.geometry.location
            });

            base.doMessage({'message': place.name}, marker);

            if (place.geometry.viewport) {
                // Only geocodes have viewport.
                bounds.union(place.geometry.viewport);
            } else {
                bounds.extend(place.geometry.location);
            }
            base.map.fitBounds(bounds);
        });
    },

    loadMarkers: function()
    {
        var base = this;
        this.clearMarkers();

        var request = new XMLHttpRequest();
        request.open('GET', base.URL, true);

        request.onload = function() {
            if (request.status >= 200 && request.status < 400) {
                // Success!
                var data = JSON.parse(request.responseText);
                base.markers = data;
                base.insertMarkers(data);
            } else {
                // We reached our target server, but it returned an error
                console.log('We reached our target server, but it returned an error');
            }
        };

        request.onerror = function() {
            // There was a connection error of some sort
            console.log('There was a connection error of some sort');
        };

        request.send();
    },

    drawDirections: function ()
    {
        var base = this;
        if (base.options.waypoints.start === undefined ||
            base.options.waypoints.end === undefined) {
            console.log('You must define start and end point of the way!');
        }
        var start = base.options.waypoints.start;
        var end = base.options.waypoints.end;
        var waypoints = [];

        if (base.options.waypoints.waypoints !== undefined) {
            for (var i = 0; i < base.options.waypoints.waypoints.length; i++) {
                waypoints.push({
                    location: new google.maps.LatLng(
                        base.options.waypoints.waypoints[i].position[0],
                        base.options.waypoints.waypoints[i].position[1]),
                    stopover:true});
            }
        }

        base.directionsDisplay = new google.maps.DirectionsRenderer();
        base.directionsService = new google.maps.DirectionsService();
        base.directionsDisplay.setMap(base.map);
        var request = {
            origin: new google.maps.LatLng(start.position[0], start.position[1]),
            destination: new google.maps.LatLng(end.position[0], end.position[1]),
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode[base.options.waypoints.travelmode]
        };

        function merge_options(obj1,obj2){
            var obj3 = {};
            for (var attrname in obj1) {
                if (attrname !== 'start' && attrname !== 'end' &&
                    attrname !== 'travelmode') {
                    obj3[attrname] = obj1[attrname];
                }
            }
            for (var attrname in obj2) {
                if (attrname !== 'start' && attrname !== 'end' &&
                    attrname !== 'travelmode' && attrname !== 'waypoints') {
                    obj3[attrname] = obj2[attrname];
                }
            }
            return obj3;
        }

        request = merge_options(request, base.options.waypoints);
        base.directionsService.route(request, function(response, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                base.directionsDisplay.setDirections(response);
                var route = response.routes[0];
            }
        });
    },

    insertMarkers: function(markers)
    {
        var base = this;

        markers.forEach(function(item, i){
            var marker,
                position = new google.maps.LatLng(markers[i]['position'][0], markers[i]['position'][1]);
            base.doBounds('fill', position);

            marker = new google.maps.Marker({
                position: position,
                map: base.map,
                title: (("title" in markers[i]) ? markers[i]['title'] : null)
            });

            marker.setAnimation(base.doAdmination(item));

            base.doColor(item, marker);

            base.doIcon(item, marker);

            base.doMessage(item, marker);

            if (base.options.cluster)
            {
                base.markersCluster.push(marker);
            }

            if (typeof base.markerEvents !== "undefined") {
                base.markerEvents.call(base, marker);
            }
        });

        base.doBounds('fit');


        if (base.options.cluster)
        {
            if (typeof MarkerClusterer != 'undefined') {
                new MarkerClusterer(base.map, base.markersCluster, base.options.clusterOptions);
            } else
            {
                throw 'MarkerClusterer is not loaded! Please use markerclusterer.js from client-side folder';
            }
        }
    },

    clearMarkers: function()
    {
        var base = this;
        for (var i = 0; i < base.markers.length; i++ ) {
            base.markers[i].setMap(null);
        }
        base.markers.length = 0;
    },

    doBounds: function(functionName, position)
    {
        var base = this;
        if (base.options.bound)
        {
            var fn = {
                init: function()
                {
                    base.boundsProperty = new google.maps.LatLngBounds();
                },
                fill: function()
                {
                    base.boundsProperty.extend(position);
                },
                fit: function()
                {
                    base.map.fitBounds(base.boundsProperty);
                }
            };
            fn[functionName]();
        }
    },

    doAdmination: function(marker)
    {
        var animation;
        if ("animation" in marker)
        {
            animation = google.maps.Animation[marker.animation];
        }

        return animation;
    },

    doMessage: function(option, marker)
    {
        var base = this;
        var infoWindow = new google.maps.InfoWindow();
        var prevInfo = false;
        // Allow each marker to have an info window
        if (("message" in option))
        {

            google.maps.event.addListener(marker, 'click', function() {
                if (prevInfo) {
                    console.log('ifff');
                    prevInfo.close();
                }

                console.log(prevInfo);
                prevInfo = infoWindow;
                infoWindow.setContent('<div>'+option['message']+'</div>');
                infoWindow.open(base.map, marker);
            });

            if ("autoOpen" in option && option['autoOpen'])
            {
                infoWindow.setContent('<div>'+option['message']+'</div>');
                infoWindow.open(base.map, marker);
            }
        }
    },

    doProportions: function()
    {
        this.element.style.width = this.options.proportions[0];
        this.element.style.height = this.options.proportions[1];
    },

    doColor: function(option, marker)
    {
        var base = this;

        if ("color" in option && base.allowColors.indexOf(option['color']) >= 0)
        {
            marker.setIcon('https://maps.google.com/mapfiles/ms/icons/'+option['color']+'-dot.png');
        }
    },

    doIcon: function(option, marker)
    {
        if ("icon" in option)
        {
            var host = "https://"+window.location.hostname;
            if( option['icon'] instanceof Object ) {
                var icon = {
                    url: host+this.basePath + '/' + option['icon']['url']
                };

                if (option['icon']['size'] !== null) {
                    icon['size'] = new google.maps.Size(option['icon']['size'][0], option['icon']['size'][1]);
                }

                if (option['icon']['anchor'] !== null) {
                    icon['size'] = new new google.maps.Point(option['icon']['anchor'][0], option['icon']['anchor'][1]);
                }

                if (option['icon']['origin'] !== null) {
                    icon['size'] = new new google.maps.Point(option['icon']['orign'][0], option['icon']['origin'][1]);
                }

            } else {
                var icon = {
                    url: host+this.basePath + '/' + option['icon']
                };
            }

            marker.setIcon(icon);
        }
    },

    processGeolocation: function(locationToSearchFor, base) {
        var geocoder = new google.maps.Geocoder();

        geocoder.geocode( { 'address': locationToSearchFor }, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {

                base.map.setCenter(results[0].geometry.location);
                base.map.fitBounds(results[0].geometry.viewport);

                if (base.options.useSearch) {
                    base.geocodeMarker = new google.maps.Marker({
                        position: results[0].geometry.location,
                        map: base.map,
                        icon: base.markerIcon
                    });
                }

                var lat = results[0].geometry.location.lat();
                var lng = results[0].geometry.location.lng();

                if (base.options.useSearch)
                    base.searchCoordinatesInput.value = lat+';'+lng;
            } else if (status == google.maps.GeocoderStatus.ZERO_RESULTS) {
                base.setMapCenter({
                    'lat': base.options.geocode.coordinates[0],
                    'lng': base.options.geocode.coordinates[1]
                });
            }
        });
    },

    doGeocode: function(searchLocation) {
        var base = this;


        if (searchLocation) {
            base.processGeolocation(searchLocation, base);
            return;
        }


        if (base.options.geocode.hasOwnProperty('coordinates')) {
            var latLng = {
                'lat': base.options.geocode.coordinates[0],
                'lng': base.options.geocode.coordinates[1]
            };

            if (base.options.useSearch)
                base.searchCoordinatesInput.value =  latLng.lat+';'+latLng.lng;
        }

        // location priority - if coordinates and location are present, search only by location
        if (base.options.geocode.hasOwnProperty('location')) {
            base.processGeolocation(base.options.geocode.location, base);
        } else {
            base.setMapCenter(latLng);
        }
    },

    setMapCenter: function (latLng) {
        var base = this;

        if (base.options.geocode.hasOwnProperty('coordinates')) {
            base.map.setCenter(latLng);
            base.map.setZoom(4);

            base.geocodeMarker = new google.maps.Marker({
                position: latLng,
                map: base.map,
                icon: base.markerIcon
            });
        }
    },

    getKey: function()
    {
        return this.options.key;
    }
};

function loadScript() {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    var key = (map.getKey() !== null ? "&key="+map.getKey() : '');
    var useSearch = map.options.useSearch? "&libraries=places" : '';
    script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&' +
        'callback=map.initialize'+key+useSearch;
    document.body.appendChild(script);
}
