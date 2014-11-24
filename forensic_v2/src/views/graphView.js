define(['hbs!templates/graph','../util/events', '../graph','../layout/layout','../util/testData', '../layout/radialLayout'],
		function(graphTemplate,events,Graph,Layout,testData,RadialLayout) {


	/**
	 * Requests a graph from a trail specification.   Automatically uses the browse path with adjacent URLS as the
	 * analytic.
	 * @param trail - A trail object as returned from DataWake server
	 * @returns A jQuery promise for the POST request that fetches the graph for the requested trail
	 */
	function fetchDatawakeGraphFor(trail) {
		var requestData = {
			name : 'browse path - with adjacent urls min degree 2',
			startdate : 1416459600,
			enddate : 1416546000
		};
		requestData.users = trail.users;
		requestData.domain = trail.domain;
		requestData.trail = trail.trail;
		return $.ajax({
			type: 'POST',
			url: '/datawake/forensic/graphservice/get',
			data: JSON.stringify(requestData),
			contentType: 'application/json',
			dataType: 'json'
		});
	}

	/**
	 * Renders a graph from the response to a POST request with a trail
	 * @param response - Response from '/datawake/forensic/graphservice/get' with a trail as input
	 */
	function getForensicGraph(response) {
		var d = new $.Deferred();
		var nodes = [];
		var nodeMap = {};
		response.nodes.forEach(function(node) {
			if (node.type.trim() === 'browse path') {
				var forensicNode = {
					x:0,
					y:0,
					fillStyle:'#ff0000',
					strokeStyle:'#232323',
					strokeSize:2,
					radius : 10,
					label : node.id
				};
				for (var key in node) {
					if (node.hasOwnProperty(key)) {
						forensicNode[key] = node[key];
					}
				}
				nodes.push(forensicNode);
				nodeMap[forensicNode.index] = forensicNode;
			}
		});

		var links = [];
		response.links.forEach(function(link) {
			if (nodeMap[link.source] && nodeMap[link.target]) {
				var forensicLink = {
					source : nodeMap[link.source],
					target : nodeMap[link.target],
					strokeStyle : '#343434'
				};
				links.push(forensicLink);
			}
		});

		var graph = {
			nodes : nodes,
			links : links
		};
		return d.resolve(graph);
	}

	/**
	 * Renders graph contained in forensicGraph to graphInstance
	 * @param forensicGraph - an object containing nodes and links in a format that graph.js can draw
	 * @param graphInstance - the graph object being drawn
	 */
	function renderForensicGraph(forensicGraph,graphInstance) {
		graphInstance.nodes(forensicGraph.nodes)
			.links(forensicGraph.links)
			.draw()
			.layout();
	}

	return {
		/**
		 * Creates a graph view element
		 * @param element - The container for the view.   Does not get cleared on insertion
		 * @param context - Any additional data required for the view.  Currently nothing.
		 */
		insert : function(element,context) {
			var graphViewElement = $(graphTemplate(context));
			var jqCanvas = graphViewElement;

			//var testNodes = testData.randomNodes(10,20);
			//var testLinks = testData.radialLinks(testNodes,0);
			//var radialLayouter = new RadialLayout()
			//	.focus(testNodes[0])
			//	.distance(300);

			var graph = new Graph()
				.canvas(jqCanvas[0])
				.pannable()
				.draw();



			$(window).resize(function() {
				var width = $(window).width();
				var height = $(window).height() - jqCanvas.offset().top;

				graph.resize(width,height);
			});

			events.subscribe(events.topics.TRAIL_CHANGE, function(trailInfo) {
				fetchDatawakeGraphFor(trailInfo).then(getForensicGraph).then(function(forensicGraph) {
					renderForensicGraph(forensicGraph,graph);
				});
			});

			graphViewElement.appendTo(element);
			$(window).resize();
		}
	};
});