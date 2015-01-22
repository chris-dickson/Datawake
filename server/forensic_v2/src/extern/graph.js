!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.GraphJS=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var _ = _dereq_('./util');
var Layout = _dereq_('./layout');

var ColumnLayout = function() {
	Layout.apply(this);
};

ColumnLayout.prototype = _.extend(ColumnLayout.prototype, Layout.prototype, {

	/**
	 * A column layout
	 * @param w - width of canvas
	 * @param h - height of canvas
	 */
	layout : function (w, h) {
		var x = 0;
		var y = 0;
		var maxRadiusCol = 0;
		var that = this;
		this._nodes.forEach(function (node) {

			if (y === 0) {
				y += node.radius;
			}
			if (x === 0) {
				x += node.radius;
			}

			that._setNodePositionImmediate(node, x, y);

			maxRadiusCol = Math.max(maxRadiusCol, node.radius);

			y += node.radius + 40;
			if (y > h) {
				y = 0;
				x += maxRadiusCol + 40;
				maxRadiusCol = 0;
			}
		});
	}
});

module.exports = ColumnLayout;

},{"./layout":3,"./util":7}],2:[function(_dereq_,module,exports){
var _ = _dereq_('./util');

/**
 * Creates a base grouping manager.   This is an abstract class.   Child classes should override the
 * initializeHeirarchy function to create nodes/links that are aggregated for their specific implementation
 * @constructor
 */
var GroupingManager = function(attributes) {
	this._initialize();
	_.extend(this,attributes);
};

GroupingManager.prototype = _.extend(GroupingManager.prototype, {
	_initialize : function() {
		this._nodes = [];
		this._links = [];

		this._aggregatedNodes = [];
		this._aggregatedLinks = [];
		this._aggregateNodeMap = {};

		this._ungroupedAggregates = {};
		this._ungroupedNodeGroups = {};
	},

	/**
	 * Reset heirarchy
	 */
	clear : function() {
		this._initialize();
	},

	/**
	 * Gets/sets the original nodes in the graph without grouping
	 * @param nodes - a graph.js node array
	 * @returns {*}
	 */
	nodes : function(nodes) {
		if (nodes) {
			this._nodes = nodes;
		} else {
			return this._nodes;
		}
		return this;
	},

	/**
	 * Gets/sets the original links in the graph without grouping
	 * @param links - a graph.js link array
	 * @returns {*}
	 */
	links : function(links) {
		if (links) {
			this._links = links;
		} else {
			return this._links;
		}
		return this;
	},

	/**
	 * Initializes the node/link aggregation
	 */
	initializeHeirarchy : function() {

		this._ungroupedAggregates = {};
		this._ungroupedNodeGroups = {};

		this._aggregateNodes();
		this._aggregateLinks();

		var setParentPointers = function(node,parent) {
			if (node.children) {
				node.children.forEach(function(child) {
					setParentPointers(child,node);
				});
			}
			node.parentNode = parent;
		};

		this._aggregatedNodes.forEach(function(node) {
			setParentPointers(node,null);
		});

		if (this.onAggregationComplete) {
			this.onAggregationComplete();
		}
	},

	/**
	 * Creates an aggregated link in graph.js format.   Can be overriden by specific implementations to allow
	 * to allow for diferent link types based on aggregate contents
	 * @param sourceAggregate - the source aggregate node
	 * @param targetAggregate - the target aggregate node
	 * @returns {{source: *, target: *}} - a graph.js link
	 * @private
	 */
	_createAggregateLink : function(sourceAggregate,targetAggregate,originalLinks) {
		return {
			source : sourceAggregate,
			target : targetAggregate
		};
	},

	/**
	 * Performs link aggregate based on a set of aggregated nodes and a full set of links
	 * @private
	 */
	_aggregateLinks : function() {
		var nodeIndexToAggreagateNode = {};
		var that = this;
		this._aggregatedNodes.forEach(function(aggregate) {
			if (aggregate.children) {
				aggregate.children.forEach(function(node) {
					nodeIndexToAggreagateNode[node.index] = aggregate;
				});
			} else {
				nodeIndexToAggreagateNode[aggregate.index] = aggregate;
			}
			that._aggregateNodeMap[aggregate.index] = aggregate;
		});


		var aggregatedLinks = [];

		var aggregateLinkMap = {};

		this._links.forEach(function(link) {
			var sourceAggregate = nodeIndexToAggreagateNode[link.source.index];
			var targetAggregate = nodeIndexToAggreagateNode[link.target.index];

			if (!sourceAggregate || !targetAggregate) {
				return;
			}

			var sourceMap = aggregateLinkMap[sourceAggregate.index];
			if (!sourceMap) {
				sourceMap = {};
			}
			var sourceToTargetLinks = sourceMap[targetAggregate.index];
			if (!sourceToTargetLinks) {
				sourceToTargetLinks = [];
			}
			sourceToTargetLinks.push(link);
			sourceMap[targetAggregate.index] = sourceToTargetLinks;

			aggregateLinkMap[sourceAggregate.index] = sourceMap;
		});

		// Get min/max link counts for all aggregate pairs
		var minCount = Number.MAX_VALUE;
		var maxCount = 0;
		for (var sourceAggregateId in aggregateLinkMap) {
			if (aggregateLinkMap.hasOwnProperty(sourceAggregateId)) {
				for (var targetAggregateId in aggregateLinkMap[sourceAggregateId]) {
					if (aggregateLinkMap[sourceAggregateId].hasOwnProperty(targetAggregateId)) {
						var source = that._aggregateNodeMap[sourceAggregateId];
						var target = that._aggregateNodeMap[targetAggregateId];
						var originalLinks = aggregateLinkMap[sourceAggregateId][targetAggregateId];
						minCount = Math.min(minCount,originalLinks.length);
						maxCount = Math.max(maxCount,originalLinks.length);
					}
				}
			}
		}

		for (var sourceAggregateId in aggregateLinkMap) {
			if (aggregateLinkMap.hasOwnProperty(sourceAggregateId)) {
				for (var targetAggregateId in aggregateLinkMap[sourceAggregateId]) {
					if (aggregateLinkMap[sourceAggregateId].hasOwnProperty(targetAggregateId)) {
						var source = that._aggregateNodeMap[sourceAggregateId];
						var target = that._aggregateNodeMap[targetAggregateId];
						var originalLinks = aggregateLinkMap[sourceAggregateId][targetAggregateId];
						var link = that._createAggregateLink(source, target, originalLinks, minCount, maxCount);
						if (link) {
							aggregatedLinks.push(link);
						}
					}
				}
			}
		}

		this._aggregatedLinks = aggregatedLinks;
	},


	/**
	 * Perform node aggregation.   Must be overriden by implementors
	 * @private
	 */
	_aggregateNodes : function() {

	},

	/**
	 * Returns the aggregated nodes
	 * @returns {Array} of graph.js nodes
	 */
	aggregatedNodes : function() {
		return this._aggregatedNodes;
	},

	/**
	 * Returns the aggregated links
	 * @returns {Array} of graph.js links
	 */
	aggregatedLinks : function()  {
		return this._aggregatedLinks;
	},

	/**
	 * Remove a node from the heriarchy
	 * @param node
	 */
	remove : function(node) {
		var index = -1;
		for (var i = 0; i < this._aggregatedNodes.length && index === -1; i++) {
			if (this._aggregatedNodes[i].index === node.index) {
				index = i;
			}
		}
		if (index !== -1) {
			this._aggregatedNodes.splice(index,1);
		}
	},


	/**
	 * Do any updates on children before layout  (ie/ set position, row/col info, etc).   Should be defined
	 * in implementing class
	 * @param aggregate
	 * @private
	 */
	_updateChildren : function(aggregate) {
		// set childrens position initially to the position of the aggregate
		aggregate.children.forEach(function(child) {
			child.x = aggregate.x;
			child.y = aggregate.y;
		});
	},

	/**
	 * Ungroup an aggregate node
	 * @param node
	 */
	ungroup : function(node) {
		if (node.children) {

			var parentKey = '';
			node.children.forEach(function(node) {
				parentKey += node.index + ',';
			});

			this._ungroupedAggregates[parentKey] = node;

			var index = -1;
			for (var i = 0; i < this._aggregatedNodes.length && index === -1; i++) {
				if (this._aggregatedNodes[i].index === node.index) {
					index = i;
				}
			}

			this._updateChildren(node);

			var first = this._aggregatedNodes.slice(0,index);
			var middle = node.children;
			this._ungroupedNodeGroups[parentKey] = node.children;
			var end = this._aggregatedNodes.slice(index+1);

			this._aggregatedNodes = first.concat(middle).concat(end);

			// Recompute aggregated links
			this._aggregateLinks();
			return parentKey;
		}
		return null;
	},

	/**
	 * Returns the aggregate node for an expanded group
	 * @param aggregateKey - key returned from ungroup
	 * @returns {*}
	 */
	getAggregate : function(aggregateKey) {
		return this._ungroupedAggregates[aggregateKey];
	},

	/**
	 * Regroups an ungrouped aggregate
	 * @param aggregateKey - key returned from ungroup
	 * @param atIndex - reinserts the aggregate at a specific position
	 * @returns {*}
	 */
	regroup : function(aggregateKey,atIndex) {
		var aggregateNode = this._ungroupedAggregates[aggregateKey];
		var nodesToRemove = aggregateNode.children;
		var that = this;
		nodesToRemove.forEach(function(node) {
			that.remove(node);
		});
		var start = this._aggregatedNodes.slice(0,atIndex);
		var end = this._aggregatedNodes.slice(atIndex);
		this._aggregatedNodes = start.concat(aggregateNode).concat(end);
		this._aggregateLinks();
		delete this._ungroupedAggregates[aggregateKey];
		delete this._ungroupedNodeGroups[aggregateKey];
		return aggregateNode;
	},

	/**
	 * Returns an array of node groups that are expanded
	 * @returns {Array}
	 */
	getUngroupedNodes : function() {
		var info = [];
		var that = this;
		Object.keys(this._ungroupedNodeGroups).forEach(function(key) {
			var nodes = that._ungroupedNodeGroups[key];
			var nodeIndices = nodes.map(function(node) {
				return node.index;
			});
			info.push({
				indices : nodeIndices,
				key : key
			});
		});
		return info;
	},

	/**
	 * Returns a list of ungrouped nodes for an aggregate
	 * @param key - key returned from ungroup
	 * @returns {*}
	 */
	getUngroupedNodesForKey : function(key) {
		return this._ungroupedNodeGroups[key];
	},

	/**
	 * Returns the x,y position (relative to group bounding box) for the
	 * regroup (minimize) icon
	 * @param boundingBox - bounding box of nodes
	 * @param ungroupedNodes - collection of ungrouped nodes
	 * @returns {{x: *, y: *}}
	 */
	getMinimizeIconPosition : function(boundingBox,ungroupedNodes) {
		return {
			x : boundingBox.x + boundingBox.width + 10,
			y : boundingBox.y
		};
	}
});


module.exports = GroupingManager;

},{"./util":7}],3:[function(_dereq_,module,exports){
var _ = _dereq_('./util');

/**
 * Layout constructor
 * @constructor
 */
var Layout = function(attributes) {
	this._nodes = null;
	this._linkMap = null;
	this._nodeMap = null;
	this._labelMap = null;
	this._duration = 250;
	this._easing = 'ease-in-out';
	this._zoomScale = 1.0;
	this._scene = null;
	this._eventsSuspended = false;
	_.extend(this,attributes);
};

Layout.prototype = _.extend(Layout.prototype, {

	/**
	 * Gets/sets the duration of the layout animation
	 * @param duration - the duration of the layout animation in milliseconds.  (default = 250ms)
	 * @returns {Layout} if duration param is defined, {Layout._duration} otherwise
	 */
	duration : function(duration) {
		if (duration) {
			this._duration = duration;
		} else {
			return this._duration;
		}
		return this;
	},

	/**
	 * Gets/sets the easing of the layout animation
	 * @param easing - the easing of the layout animation in milliseconds.  (default = 'ease-in-out')
	 * @returns {Layout} if easing param is defined, {Layout._easing} otherwise
	 */
	easing : function(easing) {
		if (easing) {
			this._easing = easing;
		}	 else {
			return this._easing;
		}
		return this;
	},

	/**
	 * Gets/sets the nodes of the layout.   Set from the graph
	 * @param nodes - the set of nodes defined in the corresponding graph
	 * @returns {Layout} if nodes param is defined, {Layout._nodes} otherwise
	 */
	nodes : function(nodes) {
		if (nodes) {
			this._isUpdate = nodes ? true : false;
			this._nodes = nodes;
		} else {
			return this._nodes;
		}
		return this;
	},

	/**
	 * Gets/sets the link map of the layout.   Set from the graph
	 * @param linkMap - a map from node index to a set of lines (path objects) that contain that node
	 * @returns {Layout} if linkMap param is defined, {Layout._linkMap} otherwise
	 */
	linkMap : function(linkMap) {
		if (linkMap) {
			this._linkMap = linkMap;
		} else {
			return this._linkMap;
		}
		return this;
	},

	/**
	 * Gets/sets the node map of the layout.   Set from the graph
	 * @param nodeMap - a map from node index to a circle (path object)
	 * @returns {Layout} if nodeMap param is defined, {Layout._nodeMap} otherwise
	 */
	nodeMap : function(nodeMap) {
		if (nodeMap) {
			this._nodeMap = nodeMap;
		} else {
			return this._nodeMap;
		}
		return this;
	},

	/**
	 * Gets/sets the label of the layout.   Set from the graph
	 * @param labelMap - a map from node index to a text object (path object)
	 * @returns {Layout} if labelMap param is defined, {Layout._labelMap} otherwise
	 */
	labelMap : function(labelMap) {
		if (labelMap) {
			this._labelMap = labelMap;
		} else {
			return this._labelMap;
		}
		return this;
	},

	scene : function(scene) {
		if (scene) {
			this._scene = scene;
		} else {
			return this._scene;
		}
		return this;
	},

	/**
	 * Returns a bounding box for an array of node indices
	 * @param nodeOrIndexArray - array of node indicies or node array itself
	 * @param padding - padding in pixels applied to bounding box
	 * @returns {{min: {x: Number, y: Number}, max: {x: number, y: number}}}
	 */
	getBoundingBox : function(nodeOrIndexArray,padding,bIncludeLabels) {
		if (!nodeOrIndexArray || !nodeOrIndexArray.length || nodeOrIndexArray.length === 0 || Object.keys(this._nodeMap).length === 0) {
			return {
				x : 0,
				y : 0,
				width : 1,
				height : 1
			};
		}


		var min = {
			x : Number.MAX_VALUE,
			y : Number.MAX_VALUE
		};
		var max = {
			x : -Number.MAX_VALUE,
			y : -Number.MAX_VALUE
		};

		var bbPadding = padding || 0;

		var that = this;
		nodeOrIndexArray.forEach(function(nodeOrIndex) {
			var idx = nodeOrIndex instanceof Object ? nodeOrIndex.index : nodeOrIndex;
			var circle = that._nodeMap[idx];
			min.x = Math.min(min.x, (circle.finalX || circle.x) - (circle.radius + bbPadding));
			min.y = Math.min(min.y, (circle.finalY || circle.y) - (circle.radius + bbPadding));
			max.x = Math.max(max.x, (circle.finalX || circle.x) + (circle.radius + bbPadding));
			max.y = Math.max(max.y, (circle.finalY || circle.y) + (circle.radius + bbPadding));
		});

		if (bIncludeLabels) {
			Object.keys(this._labelMap).forEach(function(nodeIndex) {
				var label = that._labelMap[nodeIndex];
				var measurements = that._scene.measure(label);
				var minx,miny,maxx,maxy;
				if (label.textAlign === 'start' || label.textAlign === 'left' || !label.textAlign) {
					minx = label.x;
					maxx = minx + measurements.width;
				} else if (label.textAlign === 'center') {
					minx = label.x - measurements.width/2;
					maxx = label.x + measurements.width/2;
				} else if (label.textAlign === 'end' || label.textAlign === 'right') {
					minx = label.x - measurements.width;
					maxx = label.x;
				} else {
					return;
				}
				miny = label.y - measurements.height;
				maxy = label.y;

				min.x = Math.min(min.x,minx);
				min.y = Math.min(min.y,miny);
				max.x = Math.max(max.x,maxx);
				max.y = Math.max(max.y,maxy);
			});
		}
		return {
			x : min.x,
			y : min.y,
			width : (max.x - min.x),
			height : (max.y - min.y)
		};
	},

	/**
	 * Sets whethere we should apply zoom when performing a layout.   Should never be
	 * called by user
	 * @param bApply
	 * @returns {Layout}
	 * @private
	 */
	_applyZoomScale : function(bApply) {
		this._applyZoom = bApply;
		return this;
	},

	/**
	 * Sets the position of a node and all attached links and labels without animation
	 * @param node - the node object being positioned
	 * @param x - the new x position for the node
	 * @param y - the new y position for the node
	 * @private
	 */
	_setNodePositionImmediate : function(node,x,y,callback) {
		this._setNodePosition(node,x,y,true);
		if (callback) {
			callback();
		}
	},

	/**
	 * Sets the position of a node by animating from it's old position to it's new one
	 * @param node - the node being repositioned
	 * @param x - the new x position of the node
	 * @param y - the new y position of the node
	 * @param bImmediate - if true, sets without animation.
	 * @private
	 */
	_setNodePosition : function(node,newX,newY,bImmediate,callback) {
		var x = newX * (this._applyZoom ? this._zoomScale : 1);
		var y = newY * (this._applyZoom ? this._zoomScale : 1);


		// Update the node render object
		var circle = this._nodeMap[node.index];
		if (bImmediate!==true) {
			circle.tweenAttr({
				x: x,
				y: y
			}, {
				duration: this._duration,
				easing: this._easing,
				callback : function() {
					delete circle.finalX;
					delete circle.finalY;
					node.x = x;
					node.y = y;
					if (callback) {
						callback();
					}
				}
			});
			circle.finalX = x;
			circle.finalY = y;
		} else {
			circle.x = x;
			circle.y = y;
		}
		if (this._linkMap[node.index].length === 0) {
			node.x = x;
			node.y = y;
			circle.x = x;
			circle.y = y;
		}

		// Update the label render object
		var label = this._labelMap[node.index];
		if (label) {
			var labelPos = this.layoutLabel(circle);
			if (bImmediate!==true) {
				label.tweenAttr(labelPos, {
					duration: this._duration,
					easing: this._easing
				});
			} else {
				for (var prop in labelPos) {
					if (labelPos.hasOwnProperty(prop)) {
						label[prop] = labelPos[prop];
					}
				}
			}
		}


		// Update the link render object
		var that = this;
		this._linkMap[node.index].forEach(function(link) {
			var linkObjKey = null;
			if (link.source.index === node.index) {
				linkObjKey = 'source';
			} else {
				linkObjKey = 'target';
			}
			if (bImmediate!==true) {
				link.tweenObj(linkObjKey, {
					x: x,
					y: y
				}, {
					duration: that._duration,
					easing: that._easing
				});
			} else {
				link[linkObjKey].x = x;
				link[linkObjKey].y = y;
			}
		});
	},

	/**
	 * Layout handler.   Calls implementing layout routine and provides a callback if it's async
	 * @param w - the width of the canvas being rendered to
	 * @param h - the height of the canvas being rendered to
	 * @returns {Layout}
	 */
	layout : function(w,h,callback) {
		var that = this;
		function onComplete() {
			that._eventsSuspended = false;
			if (callback) {
				callback();
			}
		}

		this._eventsSuspended = true;
		var isAsync = !this._performLayout(w,h);
		if (isAsync) {
			setTimeout(onComplete,this.duration());
		} else {
			onComplete();
		}
		return this;
	},

	/**
	 * Default layout that does nothing.   Should be overriden
	 * @param w
	 * @param h
	 * @private
	 */
	_performLayout : function(w,h) {

	},


	/**
	 * 	/**
	 * Hook for doing any drawing before rendering of the graph that is layout specific
	 * ie/ Backgrounds, etc
	 * @param w - the width of the canvas
	 * @param h - the height of the canvas
	 * @returns {Array} - a list of path.js render objects to be added to the scene
	 */
	prerender : function(w,h) {
		return [];
	},

	/**
	 * Hook for doing any drawing after rendering of the graph that is layout specific
	 * ie/ Overlays, etc
	 * @param w - the width of the canvas
	 * @param h - the height of the canvas
	 * @returns {Array} - a list of path.js render objects to be added to the scene
	 */
	postrender : function(w,h) {
		return [];
	},

	/**
	 * Callback for updating post render objects.   Usually rendered in screenspace
	 * @param minx - min x coordinate of screen
	 * @param miny - min y coordinate of screen
	 * @param maxx - max x coordinate of screen
	 * @param maxy - max y coordinate of screen
	 */
	postrenderUpdate : function(minx,miny,maxx,maxy) {

	},

	/**
	 * Sets the label position for a node
	 * @param nodeX - the x position of the node
	 * @param nodeY - the y position of the node
	 * @param radius - the radius of the node
	 * @returns {{x: x position of the label, y: y position of the label}}
	 */
	layoutLabel : function(node) {
		return {
			x: node.x + node.radius + 5,
			y: node.y + node.radius + 5
		};
	}
});



module.exports = Layout;

},{"./util":7}],4:[function(_dereq_,module,exports){
var LINK_TYPE = {
	DEFAULT : 'line',
	LINE : 'line',
	ARROW : 'arrow',
	ARC : 'arc'
};
module.exports = LINK_TYPE;
},{}],5:[function(_dereq_,module,exports){
var _ = _dereq_('./util');
var LINK_TYPE = _dereq_('./linkType');
var Layout = _dereq_('./layout');

var REGROUND_BB_PADDING = 0;

/**
 * Creates a Graph render object
 * @constructor
 */
var Graph = function(attributes) {
	this._nodes = [];
	this._links = [];
	this._canvas = null;
	this._layouter = null;
	this._groupingManager = null;
	this._width = 0;
	this._height = 0;
	this._zoomScale = 1.0;
	this._zoomLevel = 0;
	this._scene = null;
	this._showAllLabels = false;
	this._prerenderGroup = null;
	this._postrenderGroup = null;
	this._pannable = null;
	this._zoomable = null;
	this._draggable = null;
	this._currentOverNode = null;
	this._currentMoveState = null;
	this._invertedPan = 1;

	this._fontSize = null;
	this._fontFamily = null;
	this._fontColor = null;
	this._fontStroke = null;
	this._fontStrokeWidth = null;
	this._shadowColor = null;
	this._shadowOffsetX = null;
	this._shadowOffsetY = null;
	this._shadowBlur = null;

	// Data to render object maps
	this._nodeIndexToLinkLine = {};
	this._nodeIndexToCircle = {};
	this._nodeIndexToLabel = {};

	_.extend(this,attributes);
};

Graph.prototype = _.extend(Graph.prototype, {
	/**
	 * Gets/sets the nodes for the graph
	 * @param nodes - an array of nodes
	 * {
	 * 		x : the x coordinate of the node	(required)
	 * 		y : the y coordinate of the node	(required)
	 *		index :  a unique index				(required)
	 *		label : a label for the node		(optional)
	 *		fillStyle : a canvas fill   		(optional, default #000000)
	 *		strokeStyle : a canvas stroke		(optional, default undefined)
	 *		lineWidth : width of the stroke		(optional, default 1)
	 * @returns {Graph} if nodes parameter is defined, {Graph._nodes} otherwise
	 */
	nodes : function(nodes) {
		if (nodes) {
			this._nodes = nodes;

			this._nodeIndexToLinkLine = {};
			this._nodeIndexToCircle = {};
			this._nodeIndexToLabel = {};
			var that = this;
			nodes.forEach(function(node) {
				that._nodeIndexToLinkLine[node.index] = [];});
			if (this._layouter) {
				this._layouter.nodes(nodes);
			}

		} else {
			return this._nodes;
		}
		return this;
	},

	/**
	 * Get node render object
	 * @param nodeIndex - index of the node
	 * @returns pathjs circle object
	 */
	nodeWithIndex : function(nodeIndex) {
		return this._nodeIndexToCircle[nodeIndex];
	},

	/**
	 * Get label render object for a node
	 * @param nodeIndex - index of the node
	 * @returns pathjs render object
	 */
	labelWithIndex : function(nodeIndex) {
		return this._nodeIndexToLabel[nodeIndex];
	},

	/**
	 * Update the render properties of a node
	 * @param nodeIndex - index of the node
	 * @param props - any pathjs properties we wish to update
	 */
	updateNode : function(nodeIndex,props) {
		// TODO:  remove mucking with position settings from props?
		if (nodeIndex) {
			var circle = this._nodeIndexToCircle[nodeIndex];
			circle = _.extend(circle,props);
			this._nodeIndexToCircle[nodeIndex] = circle;
			this.update();
		}
	},

	/**
	 * Update the render properties of a label
	 * @param nodeIndex - index of the node this label is attached to
	 * @param props - any pathjs propertiers we with to update
	 */
	updateLabel : function(nodeIndex,props) {
		// TODO:  remove mucking with position settings from props?
		if (nodeIndex) {
			var text = this._nodeIndexToLabel[nodeIndex];
			text = _.extend(text,props);
			this._nodeIndexToLabel[nodeIndex] = text;
		}
		this.update();
	},

	/**
	 * Gets/sets the nodes for the graph
	 * @param links - an array of links
	 * {
	 * 		source : a node object corresponding to the source 	(required)
	 * 		target : a node object corresponding to the target	(required)
	 *		strokeStyle : a canvas stroke						(optional, default #000000)
	 *		lineWidth : the width of the stroke					(optinal, default 1)
	 * @returns {Graph} if links parameter is defined, {Graph._links} otherwise
	 */
	links : function(links) {
		if (links) {
			this._links = links;
		} else {
			return this._links;
		}
		return this;
	},

	/**
	 * Gets the links between two nodes
	 * @param sourceNodeIndex - Index of source node, if null, return all links going to target
	 * @param targetNodeIndex - Index of target node, if null, return all links starting from source
	 */
	linkObjectsBetween : function(sourceNodeIndex,targetNodeIndex) {
		function isProvided(param) {
			if (param === undefined || param === null) {
				return false;
			} else {
				return true;
			}
		}

		if (isProvided(sourceNodeIndex) && !isProvided(targetNodeIndex)) {
			var allSource = this._nodeIndexToLinkLine[sourceNodeIndex];
			var justSource = allSource.filter(function(link) {
				return link.source.index === sourceNodeIndex;
			});
			return justSource;
		} else if (!isProvided(sourceNodeIndex) && isProvided(targetNodeIndex)) {
			var allTarget = this._nodeIndexToLinkLine[targetNodeIndex];
			var justTarget = allTarget.filter(function(link) {
				return link.target.index === targetNodeIndex;
			});
			return justTarget;
		} else if (isProvided(sourceNodeIndex) && isProvided(targetNodeIndex)) {
			var sourceLinks = this.linkObjectsBetween(sourceNodeIndex,null);
			var toTarget = sourceLinks.filter(function(link) {
				return link.target.index === targetNodeIndex;
			});
			return toTarget;
		} else {
			return [];
		}
	},

	/**
	 * Gets/sets the canvas for the graph
	 * @param canvas - an HTML canvas object
	 * @returns {Graph} if canvas parameter is defined, the canvas otherwise
	 */
	canvas : function(canvas) {
		if (canvas) {
			this._canvas = canvas;

			var x,y;
			var that = this;
			$(this._canvas).on('mousedown',function(e) {
				x = e.clientX;
				y = e.clientY;
				$(that._canvas).on('mousemove',function(e) {
					var dx = x - e.clientX;
					var dy = y - e.clientY;
					if (that._draggable && that._currentOverNode && (that._currentMoveState === null || that._currentMoveState === 'dragging'))  {
						that._currentMoveState = 'dragging';

						// Move the node
						that._layouter._setNodePositionImmediate(that._currentOverNode, that._currentOverNode.x - dx, that._currentOverNode.y - dy);
						that.update();
					} else if (that._pannable && (that._currentMoveState === null || that._currentMoveState === 'panning')) {
						that._pan(-dx*that._invertedPan,-dy*that._invertedPan);
						that._currentMoveState = 'panning';
					}
					x = e.clientX;
					y = e.clientY;
				});
			});

			$(this._canvas).on('mouseup',function() {
				$(that._canvas).off('mousemove');
				if (that._currentMoveState === 'dragging') {
					that._currentOverNode = null;
				}
				that._currentMoveState = null;
			});


		} else {
			return this._canvas;
		}
		return this;
	},

	/**
	 * Get width
	 * @returns Width in pixels of the graph
	 */
	width : function() {
		return this._scene.width;
	},

	/**
	 * Get height
	 * @returns Height in pixels of the graph
	 */
	height : function() {
		return this._scene.height;
	},

	/**
	 * Toggles boolean for showing/hiding all labels in the graph by default
	 * @param showAllLabels
	 * @returns {*}
	 */
	showAllLabels : function(showAllLabels) {
		if (showAllLabels !== undefined) {
			this._showAllLabels = showAllLabels;
		} else {
			return this._showAllLabels;
		}

		// Update
		var that = this;
		this._nodes.forEach(function(node) {
			if (showAllLabels) {
				that.addLabel(node,node.labelText);
			} else {
				that.removeLabel(node);
			}
		});

		return this;
	},

	/**
	 * Adds a label for a node
	 * @param node
	 * @param text
	 * @returns {Graph}
	 */
	addLabel : function(node,text) {
		if (this._nodeIndexToLabel[node.index]) {
			this.removeLabel(node);
		}
		var labelAttrs = this._layouter.layoutLabel(node);

		var fontSize = typeof(this._fontSize) === 'function' ? this._fontSize(node) : this._fontSize;
		if (!fontSize) {
			fontSize = 10;
		}

		var fontFamily = typeof(this._fontFamily) === 'function' ? this._fontFamily(node) : this._fontFamily;
		if (!fontFamily) {
			fontFamily = 'sans-serif';
		}
		var fontStr = fontSize + 'px ' + fontFamily;

		var fontFill = typeof(this._fontColor) === 'function' ? this._fontColor(node) : this._fontColor;
		if (!fontFill) {
			fontFill = '#000000';
		}
		var fontStroke = typeof(this._fontStroke) === 'function' ? this._fontStroke(node) : this._fontStroke;
		var fontStrokeWidth = typeof(this._fontStroke) === 'function' ? this._fontStrokeWidth : this._fontStrokeWidth;

		var labelSpec = {
			font: fontStr,
			fillStyle: fontFill,
			strokeStyle: fontStroke,
			lineWidth: fontStrokeWidth,
			text : text
		};

		var bAddShadow = this._shadowBlur || this._shadowOffsetX || this._shadowOffsetY || this._shadowColor;
		if (bAddShadow) {
			labelSpec['shadowColor'] = this._shadowColor || '#000';
			labelSpec['shadowOffsetX'] = this._shadowOffsetX || 0;
			labelSpec['shadowOffsetY'] = this._shadowOffsetY || 0;
			labelSpec['shadowBlur'] = this._shadowBlur || Math.floor(fontSize/3);
		}

		for (var key in labelAttrs) {
			if (labelAttrs.hasOwnProperty(key)) {
				labelSpec[key] = labelAttrs[key];
			}
		}
		var label = path.text(labelSpec);
		this._nodeIndexToLabel[node.index] = label;
		this._scene.addChild(label);

		return this;
	},

	/**
	 * Removes a label for a node
	 * @param node
	 * @returns {Graph}
	 */
	removeLabel : function(node) {
		var textObject = this._nodeIndexToLabel[node.index];
		if (textObject) {
			this._scene.removeChild(textObject);
			delete this._nodeIndexToLabel[node.index];
		}
		return this;
	},

	/**
	 * Event handler for mouseover of a node
	 * @param callback(node)
	 * @param self - the object to be bound as 'this' in the callback
	 * @returns {Graph}
	 */
	nodeOver : function(callback,self) {
		if (!self) {
			self = this;
		}
		this._nodeOver = callback.bind(self);
		return this;
	},

	/**
	 * Event handler for mouseout of a node
	 * @param callback(node)
	 * @param self - the object to be bound as 'this' in the callback
	 * @returns {Graph}
	 */
	nodeOut : function(callback,self) {
		if (!self) {
			self = this;
		}
		this._nodeOut = callback.bind(self);
		return this;
	},

	/**
	 * Convenience function for setting nodeOver/nodeOut in a single call
	 * @param over - the nodeOver event handler
	 * @param out - the nodeOut event handler
	 * @param self - the object to be bound as 'this' in the callback
	 * @returns {Graph}
	 */
	nodeHover : function(over,out,self) {
		if (!self) {
			self = this;
		}
		this.nodeOver(over,self);
		this.nodeOut(out,self);
		return this;
	},

	/**
	 * Event handler for click of a node
	 * @param callback(node)
	 * @param self - the object to be bound as 'this'.   Defaults to the graph object
	 * @returns {Graph}
	 */
	nodeClick : function(callback,self) {
		if (!self) {
			self = this;
		}
		this._nodeClick = callback.bind(self);
		return this;
	},

	/**
	 * Pan {Graph} by (dx,dy).   Automatically rerender the graph.
	 * @param dx - Amount of pan in x direction
	 * @param dy - Amount of pan in y direction
	 * @private
	 */
	_pan : function(dx,dy) {
		this._scene.x += dx;
		this._scene.y += dy;
		this._panX += dx;
		this._panY += dy;
		this.update();
	},

	/**
	 * Make {Graph} pannable
	 * @returns {Graph}
	 */
	pannable : function() {
		this._pannable = true;
		return this;
	},

	/**
	 * Makes the graph pan in the opposite direction of the mouse as opposed to with it
	 * @returns {Graph}
	 */
	invertPan : function() {
		this._invertedPan = -1;
		return this;
	},

	/**
	 * Make nodes in {Graph} repoisitionable by click-dragging
	 * @returns {Graph}
	 */
	draggable : function() {
		this._draggable = true;
		return this;
	},

	_getZoomForLevel : function(level) {
		var factor = Math.pow(1.5 , Math.abs(level - this._zoomLevel));
		if (level < this._zoomLevel) {
			factor = 1/factor;
		}
		return factor;
	},

	_zoom : function(factor,x,y) {
		this._zoomScale *= factor;
		this._layouter._zoomScale = this._zoomScale;

		// Pan scene back to origin
		var originalX = this._scene.x;
		var originalY = this._scene.y;
		this._pan(-this._scene.x,-this._scene.y);

		var mouseX = x || 0;
		var mouseY = y || 0;

		// 'Zoom' nodes.   We do this so text/radius size remains consistent across zoom levels
		for (var i = 0; i < this._nodes.length; i++) {
			this._layouter._setNodePosition(this._nodes[i],this._nodes[i].x*factor, this._nodes[i].y*factor,true);
		}

		// Zoom the render groups
		this._addPreAndPostRenderObjects();


		// Reverse the 'origin pan' with the scale applied and recenter the mouse with scale applied as well
		var newMouseX = mouseX*factor;
		var newMouseY = mouseY*factor;
		this._pan(originalX*factor - (newMouseX-mouseX),originalY*factor - (newMouseY-mouseY));


		// Update the regroup underlays
		var that = this;
		if (this._handleGroup && this._handleGroup.children && this._handleGroup.children.length) {
			this._handleGroup.removeAll();
			that._scene.update();
			that._addRegroupHandles();
		}
	},

	/**
	 * Make {Graph} zoomable by using the mousewheel
	 * @returns {Graph}
	 */
	zoomable : function() {
		if (!this._zoomable) {
			var that = this;
			$(this._canvas).on('mousewheel',function(e) {
				e.preventDefault();
				if (that._eventsSuspended()) {
					return false;
				}
				var wheel = e.originalEvent.wheelDelta/120;//n or -n
				var factor;
				if (wheel < 0) {
					factor = that._getZoomForLevel(that._zoomLevel-1);
				} else {
					factor = that._getZoomForLevel(that._zoomLevel+1);
				}
				that._zoom(factor, e.offsetX, e.offsetY);

			});
			this._zoomable = true;
		}
		return this;
	},

	/**
	 * Sets the layout function for the nodes
	 * @param layouter - An instance (or subclass) of Layout
	 * @returns {Graph} is layouter param is defined, the layouter otherwise
	 */
	layouter : function(layouter) {
		if (layouter) {
			this._layouter = layouter;
			this._layouter
				.nodes(this._nodes)
				.linkMap(this._nodeIndexToLinkLine)
				.nodeMap(this._nodeIndexToCircle)
				.labelMap(this._nodeIndexToLabel)
				.scene(this._scene);
		} else {
			return this._layouter;
		}
		return this;
	},

	/**
	 * Performs a layout of the graph
	 * @returns {Graph}
	 */
	layout : function(callback) {
		if (this._layouter) {
			var that = this;
			this._layouter.layout(this._canvas.width,this._canvas.height,callback);


			// Update the regroup underlays
			if (this._handleGroup && this._handleGroup.children) {
				var underlays = this._handleGroup.children;
				underlays.forEach(function(handleObject) {
					var indices = handleObject.graphjs_indices;
					var bb = that._layouter.getBoundingBox(indices, REGROUND_BB_PADDING);
					if (handleObject.graphjs_type === 'regroup_underlay') {
						handleObject.tweenAttr({
							x: bb.x,
							y: bb.y,
							width: bb.width,
							height: bb.height
						}, {
							duration: that._layouter.duration(),
							easing: that._layouter.easing()
						});
					} else if (handleObject.graphjs_type === 'regroup_icon') {
						var ungroupedNodes = that._groupingManager.getUngroupedNodesForKey(handleObject.graphjs_group_key);
						var iconPosition = that._groupingManager.getMinimizeIconPosition(bb,ungroupedNodes);
						handleObject.tweenAttr({
							x: iconPosition.x,
							y: iconPosition.y
						}, {
							duration: that._layouter.duration(),
							easing: that._layouter.easing()
						});

					}
				});
			}
			this.update();
		}
		return this;
	},


	/**
	 * Gets/sets the grouping manager.
	 * @param groupingManager
	 * @returns {*}
	 */
	groupingManager : function(groupingManager) {
		if (groupingManager) {
			this._groupingManager = groupingManager;
		} else {
			return this._groupingManager;
		}
		return this;
	},

	/**
	 * Initializes the grouping manager provided and calls the methods for aggregating nodes and links
	 * @returns {Graph}
	 */
	initializeGrouping : function() {
		if (this._groupingManager) {

			this._nodes.forEach(function(node) {
				node.parent = undefined;
			});

			this._groupingManager.nodes(this._nodes)
				.links(this._links)
				.initializeHeirarchy();

			this.nodes(this._groupingManager.aggregatedNodes());
			this.links(this._groupingManager.aggregatedLinks());
		}
		return this;
	},

	/**
	 * Ungroups the prodided aggregate node
	 * @param node - the aggregate node to be ungrouped
	 * @returns {Graph}
	 */
	ungroup : function(node) {
		if (!node || !node.children) {
			return this;
		}
		var that = this;
		if (this._groupingManager) {
			this._groupingManager.ungroup(node);
			this.clear()
				.nodes(this._groupingManager.aggregatedNodes())
				.links(this._groupingManager.aggregatedLinks())
				.draw();

			this._layouter._applyZoomScale(true);
			this.layout();
			this._layouter._applyZoomScale(false);
		}
		return this;
	},

	/**
	 * Regroups the aggregate node.   Can be called programattically but is automatically invoked when clicking on the
	 * regroup handler
	 * @param ungroupedAggregateKey
	 */
	regroup : function(ungroupedAggregateKey) {
		// Animate the regroup
		var that = this;
		var parentAggregate = this._groupingManager.getAggregate(ungroupedAggregateKey);

		var avgPos = { x: 0, y : 0};
		var maxRadius = 0;
		parentAggregate.children.forEach(function(child) {
			avgPos.x += child.x;
			avgPos.y += child.y;
		});
		avgPos.x /= parentAggregate.children.length;
		avgPos.y /= parentAggregate.children.length;

		var indexOfChildren = parentAggregate.children.map(function(child) {
			for (var i = 0; i < that._groupingManager._aggregatedNodes.length; i++) {
				if (that._groupingManager._aggregatedNodes[i].index === child.index) {
					return i;
				}
			}
		});
		var minChildIndex = Number.MAX_VALUE;
		indexOfChildren.forEach(function(idx) {
			minChildIndex = Math.min(minChildIndex,idx);
		});

		var animatedRegrouped = 0;
		this._suspendEvents();			// layout will resume them
		parentAggregate.children.forEach(function(child) {

			//TODO:   When we can support transparent text in path, fade out the label as we move it together if it's showing
			that.removeLabel(child);
			that._layouter._setNodePosition(child,avgPos.x,avgPos.y,false,function() {
				animatedRegrouped++;
				if (animatedRegrouped === parentAggregate.children.length) {
					if (that._groupingManager) {
						var regroupedAggregate = that._groupingManager.regroup(ungroupedAggregateKey,minChildIndex);
						regroupedAggregate.x = avgPos.x;
						regroupedAggregate.y = avgPos.y;
						that.clear()
							.nodes(that._groupingManager.aggregatedNodes())
							.links(that._groupingManager.aggregatedLinks());
						that.draw();
						that._layouter._applyZoomScale(true);
						that.layout();
						that._layouter._applyZoomScale(false);
					}
				}
			});
		});
		this.update();
	},

	/**
	 * Gets/sets the font size for labels
	 * @param fontSize - size of the font in pixels
	 * @returns {Graph} if fontSize param is deifned, {Graph._fontSize} otherwise
	 */
	fontSize : function(fontSize) {
		if (fontSize) {
			this._fontSize = fontSize;
		} else {
			return this._fontSize;
		}
		return this;
	},

	/**
	 * Gets/sets the font colour for labels
	 * @param fontColour - A hex string for the colour of the labels
	 * @returns {Graph} if fontColour param is deifned, {Graph._fontColour} otherwise
	 */
	fontColour : function(fontColour) {
		if (fontColour) {
			this._fontColor = fontColour;
		} else {
			return this._fontColor;
		}
		return this;
	},

	/**
	 * Gets/sets the font stroke for labels
	 * @param fontStroke - A hex string for the color of the label stroke
	 * @returns {Graph} if fontStroke param is defined, {Graph._fontStroke} otherwise
	 */
	fontStroke : function(fontStroke) {
		if (fontStroke) {
			this._fontStroke = fontStroke;
		} else {
			return this._fontStroke;
		}
		return this;
	},

	/**
	 * Gets/sets the font stroke width for labels
	 * @param fontStrokeWidth - size in pixels
	 * @returns {Graph} if fontStrokeWidth param is defined, {Graph._fontStrokeWidth} otherwise
	 */
	fontStrokeWidth : function(fontStrokeWidth) {
		if (fontStrokeWidth) {
			this._fontStrokeWidth = fontStrokeWidth;
		} else {
			return this._fontStrokeWidth;
		}
		return this;
	},

	/**
	 * Gets/sets the font family for labels
	 * @param fontFamily - A string for the font family (a la HTML5 Canvas)
	 * @returns {Graph} if fontFamily param is deifned, {Graph._fontFamily} otherwise
	 */
	fontFamily : function(fontFamily) {
		if (fontFamily) {
			this._fontFamily = fontFamily;
		} else {
			return this._fontFamily;
		}
		return this;
	},

	/**
	 * Gets/sets the font shadow properties for labels
	 * @param color - the colour of the shadow
	 * @param offsetX - the x offset of the shadow from center
	 * @param offsetY - the y offset of the shadow from center
	 * @param blur - the amount of blur applied to the shadow in pixels
	 * @returns {*}
	 */
	fontShadow : function(color,offsetX,offsetY,blur) {
		if (arguments.length === 0) {
			return {
				color: this._shadowColor,
				offsetX: this._shadowOffsetX,
				offsetY: this._shadowOffsetY,
				blur: this._shadowBlur
			};
		} else {
			this._shadowColor = color;
			this._shadowOffsetX = offsetX;
			this._shadowOffsetY = offsetY;
			this._shadowBlur = blur;
			return this;
		}
	},

	/**
	 * Resize the graph.  Automatically performs layout and rerenders the graph
	 * @param w - the new width
	 * @param h - the new height
	 * @returns {Graph}
	 */
	resize : function(w,h) {
		this._width = w;
		this._height = h;
		$(this._canvas).attr({width:w,height:h})
			.width(w)
			.height(h);
		this._scene.resize(w,h);

		if (!this._pannable && !this._zoomable) {
			this.layout();
		} else {
			this._scene.update();
		}
		return this;
	},

	/**
	 * Gets a list of pre/post render objects from the layouter (if any)
	 * @private
	 */
	_addPreAndPostRenderObjects : function() {
		this._prerenderGroup.removeAll();

		// Get the background objects from the layouter
		var objs = this._layouter.prerender(this._width,this._height);
		var that = this;
		if (objs) {
			objs.forEach(function(renderObject) {
				that._prerenderGroup.addChild(renderObject);
			});
		}

		this._postrenderGroup.removeAll();
		objs = this._layouter.postrender(this._width,this._height);
		if (objs) {
			objs.forEach(function(renderObject) {
				that._postrenderGroup.addChild(renderObject);
			});
		}
	},

	/**
	 * Adds clickable boxes to regroup any ungrouped aggregates
	 * TODO:  make this look better!
	 * @private
	 */
	_addRegroupHandles : function() {
		var that = this;
		if (this._groupingManager) {
			var ungroupedNodesInfo = this._groupingManager.getUngroupedNodes();
			ungroupedNodesInfo.forEach(function(ungroupedNodeInfo) {
				var indices = ungroupedNodeInfo.indices;
				var key = ungroupedNodeInfo.key;
				var bbox = that._layouter.getBoundingBox(indices,REGROUND_BB_PADDING);
				var iconPosition = that._groupingManager.getMinimizeIconPosition(bbox,that._groupingManager.getUngroupedNodesForKey(key));
				var minimizeRenderObject = path.image({
					src : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAAlwSFlzAAEQhAABEIQBP0VFYAAAActpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+d3d3Lmlua3NjYXBlLm9yZzwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KGMtVWAAAAchJREFUOBGVlT1Ow0AQRr22Q5RIEQVCREpDroCVGo5AQ09LzQEiDsARKDgBVwgdUqKcgIYmEqJClvhNbN5neYO9sU0YaVjv7LdvZpz1YjxsNBodr1arK2PMEdMeniq+hRk0cZqm8yAIxtPp9N4IRmDi+74HVIwmmACyosYA85Ik8SjoJOj3+7cEDoG9IQwzef0fCywpKOgdRgvG0FebeWWdkqp+UqzOqjpiiOUTqXtnldVYQsWoRD0BqzJKXxfXWp2lAv7H/kxSBNoW3bGY0F2z87WmCLTZ3XEt5sFd07wELQKLG//zbJNke6rOXeJmbaALViqqCMwW+WKCBsDGkr4QbF2EBaYcSp8T/4pfInpGtEMsYc5gSm0RU1VfJD9gvGZ9l1gGtcCEoICPs9nsBtHWFkXRBXujHBiU+ofS3pr0KyztMWRQOypX8CV+h7/gLbdVYplRjY7KN76Pn+ItPGOo5RjX96xAyK1xBshjE9N6s5r8YrEFxSEb52EY6oL9ZHubMbsU61EbKzoVHxTSXS6Xc5+HsX56Rl1faltVqwV3VMx1acTo5oxxsFgsngaDwYTChrSxh0AvublfBLnpXcbAHjhC5/oX8APsCav9tH6XXQAAAABJRU5ErkJggg==',
					x : iconPosition.x,
					y : iconPosition.y,
					graphjs_type : 'regroup_icon',
					graphjs_indices : indices,
					graphjs_group_key : key,
					opacity : 0.8
				});

				var boundingBoxRenderObject = path.rect({
					x : bbox.x,
					y : bbox.y,
					graphjs_type : 'regroup_underlay',
					graphjs_indices : indices,
					width : bbox.width,
					height : bbox.height,
					strokeStyle : '#232323',
					fillStyle : '#000000',
					opacity : 0.1
				});
				minimizeRenderObject.on('click',function() {
					that.regroup(key);
				});
				that._handleGroup.addChild(minimizeRenderObject);
				that._handleGroup.addChild(boundingBoxRenderObject);
			});
			this._scene.update();
		}
	},

	/**
	 * Redraw the graph
	 * @returns {Graph}
	 */
	update : function() {
		this._layouter.postrenderUpdate();
		this._scene.update();
		return this;
	},

	/**
	 * Draw the graph.   Only needs to be called after the nodes/links have been set
	 * @returns {Graph}
	 */
	draw : function() {
		var that = this;

		if (!this._scene) {
			this._scene = path(this._canvas);
			if (this._layouter) {
				this._layouter.scene(this._scene);
			}
		}
		if (!this._layouter) {
			var defaulLayout = new Layout()
				.nodes(this._nodes)
				.nodeMap(this._nodeIndexToCircle)
				.linkMap(this._nodeIndexToLinkLine)
				.labelMap(this._nodeIndexToLabel)
				.scene(this._scene);
			this.layouter(defaulLayout);
		}
		this._prerenderGroup = path.group();
		this._handleGroup = path.group();
		this._postrenderGroup = path.group({noHit:true});


		this._scene.addChild(this._prerenderGroup);
		this._scene.addChild(this._handleGroup);
		this._links.forEach(function(link) {

			var linkObject;
			if (!link.type) {
				link.type = LINK_TYPE.DEFAULT;
			}
			switch(link.type) {
				case LINK_TYPE.ARROW:
					link.headOffset = link.target.radius;
					linkObject = path.arrow(link);
					break;
				case LINK_TYPE.ARC:
					linkObject = path.arc(link);
					break;
				case LINK_TYPE.LINE:
				case LINK_TYPE.DEFAULT:
					linkObject = path.line(link);
					break;
				default:
					linkObject = path.line(link);
					break;
			}
			that._nodeIndexToLinkLine[link.source.index].push(linkObject);
			that._nodeIndexToLinkLine[link.target.index].push(linkObject);

			that._scene.addChild(linkObject);
		});

		this._nodes.forEach(function(node) {
			var circle = path.circle(node);
			that._nodeIndexToCircle[node.index] = circle;
			if (that._nodeOver || that._draggable) {
				circle.off('mouseover');
				circle.on('mouseover', function(e) {
					if (that._eventsSuspended()) { return; }
					if (that._nodeOver) {
						that._nodeOver(circle, e);
					}
					if (that._currentMoveState!=='dragging') {
						that._currentOverNode = circle;
					}
					that._scene.update();
				});
			}
			if (that._nodeOut || that._draggable) {
				circle.off('mouseout');
				circle.on('mouseout', function(e) {
					if (that._eventsSuspended()) { return; }
					if (that._currentMoveState!=='dragging') {
						that._currentOverNode = null;
					}
					if (that._nodeOut) {
						that._nodeOut(circle, e);
					}
					that._scene.update();
				});
			}
			if (that._nodeClick) {
				circle.off('click');
				circle.on('click', function(e) {
					if (that._eventsSuspended()) { return; }
					that._nodeClick(circle,e);
					that._scene.update();
				});
			} else if (that._groupingManager) {
				circle.off('click');
				circle.on('click', function(e) {
					if (that._eventsSuspended()) { return; }
					if (that._nodeOut) {
						that._nodeOut(circle);
					}
					that.ungroup(circle);
				});
			}
			that._scene.addChild(circle);

			if (node.label) {
				that.addLabel(node,node.label);
			}
		});

		if (this.showAllLabels()) {
			this.showAllLabels(true);
		}

		this._layouter.linkMap(this._nodeIndexToLinkLine)
			.nodeMap(this._nodeIndexToCircle)
			.labelMap(this._nodeIndexToLabel);


		this._addPreAndPostRenderObjects();

		// Draw any ungrouped node bounding boxes
		this._addRegroupHandles();

		this._scene.addChild(this._postrenderGroup);
		this.update();

		return this;
	},

	/**
	 * Debug routing to draw a bounding box around the nodes
	 * @private
	 */
	_debugDrawBoundingBox : function() {
		var bIncludeLabels = true;
		var boundingBox = this._layouter.getBoundingBox(this._nodes,undefined,bIncludeLabels);
		if (this._bbRender) {
			this._scene.removeChild(this._bbRender);
		}
		this._bbRender = path.rect({
			x : boundingBox.x,
			y : boundingBox.y,
			width : boundingBox.width,
			height : boundingBox.height,
			strokeStyle : '#ff0000',
			lineWidth : 2,
			noHit : true
		});
		this._scene.addChild(this._bbRender);
		this._scene.update();
	},

	/**
	 * Fit the graph to the screen
	 */
	fit : function(padding) {

		// Return back to origin
		this._pan(-this._scene.x,-this._scene.y);



		// Working with big numbers, it's better if we do this twice.
		var boundingBox;
		for (var i = 0; i < 2; i++) {
			boundingBox = this._layouter.getBoundingBox(this._nodes,padding);
			var xRatio = this._scene.width / boundingBox.width;
			var yRatio = this._scene.height / boundingBox.height;
			this._zoom(Math.min(xRatio, yRatio), 0, 0);
		}

		var midScreenX = this._scene.width / 2;
		var midScreenY = this._scene.height / 2;
		boundingBox = this._layouter.getBoundingBox(this._nodes);
		var midBBX = boundingBox.x + boundingBox.width / 2;
		var midBBY = boundingBox.y + boundingBox.height / 2;
		this._pan(-(midBBX-midScreenX),-(midBBY-midScreenY));

		this._zoomScale = 1.0;
		this._layouter._zoomScale = 1.0;
		// Zoom the render groups
		//if (this._prerenderGroup) {
		//	this._prerenderGroup.scaleX = this._zoomScale;
		//	this._prerenderGroup.scaleY = this._zoomScale;
		//}
		//if (this._postrenderGroup) {
		//	this._postrenderGroup.scaleX = this._zoomScale;
		//	this._postrenderGroup.scaleY = this._zoomScale;
		//}
		this.update();

		return this;
	},

	/**
	 * Suspend mouse events and zooming
	 * @private
	 */
	_suspendEvents : function() {
		this._layouter._eventsSuspended = true;
	},

	/**
	 * resume mouse events and zooming
	 * @private
	 */
	_resumeEvents : function() {
		this._layouter._eventsSuspended = false;
	},

	/**
	 * Query event suspension status
	 * @returns boolean
	 * @private
	 */
	_eventsSuspended : function() {
		return this._layouter._eventsSuspended;
	},

	/**
	 * Removes all render objects associated with a graph.
	 */
	clear : function() {
		var removeRenderObjects = function(indexToObject) {
			for (var key in indexToObject) {
				if (indexToObject.hasOwnProperty(key)) {
					var obj = indexToObject[key];
					if ($.isArray(obj)) {
						for (var i = 0; i < obj.length; i++) {
							this._scene.removeChild(obj[i]);
						}
					} else {
						this._scene.removeChild(obj);
					}
					delete indexToObject[key];
				}
			}
		};
		removeRenderObjects.call(this,this._nodeIndexToCircle);
		removeRenderObjects.call(this,this._nodeIndexToLinkLine);
		removeRenderObjects.call(this,this._nodeIndexToLabel);
		if (this._prerenderGroup) {
			this._scene.removeChild(this._prerenderGroup);
		}
		if (this._handleGroup) {
			this._scene.removeChild(this._handleGroup);
		}
		if (this._postrenderGroup) {
			this._scene.removeChild(this._postrenderGroup);
		}
		this._scene.update();
		return this;
	},

	toImageURI : function(bVisible) {
		var d = new $.Deferred();

		if (bVisible) {
			return d.resolve(this._canvas.toDataURL());
		}

		var that = this;
		var originalDuration = this._layouter._duration;
		this._layouter._duration = 1;

		var captureCanvas = $('<canvas/>').appendTo($(document.body));

		var onLayoutFinished = function() {
			captureGraph._layouter.postrenderUpdate();
			var padding = 150;
			var boundingBox = captureGraph._layouter.getBoundingBox(captureGraph.nodes(),0,true);
			captureGraph.resize(boundingBox.width+padding,boundingBox.height+padding);
			captureGraph._pan(-boundingBox.x+(padding/2),-boundingBox.y + (padding/2));

			var uri = captureCanvas[0].toDataURL();
			captureCanvas.remove();

			that._layouter._scene.isExport = false;
			that.clear()
				.nodes(that._groupingManager.aggregatedNodes())
				.links(that._groupingManager.aggregatedLinks())
				.draw();

			that._layouter._applyZoomScale(true);
			that.layout(function() {
				that._layouter._duration = originalDuration;
				d.resolve(uri);
			});
			that._layouter._applyZoomScale(false);
		};

		var captureGraph = new Graph()
			.canvas(captureCanvas[0])
			.nodes(this.nodes())
			.layouter(this._layouter)
			.links(this.links())
			.fontColour(this._fontColor)
			.fontFamily(this._fontFamily)
			.fontSize(this._fontSize);

		var fs = this.fontShadow();
		if (fs) {
			captureGraph.fontShadow(fs.color, fs.offsetX, fs.offsetY, fs.blur);
		}
		captureGraph.draw();

		captureGraph._scene.isExport = true;

		if (this._showAllLabels) {
			for (var nIdx in this._nodeIndexToLabel) {
				if (this._nodeIndexToLabel.hasOwnProperty(nIdx)) {
					captureGraph.addLabel(this.nodeWithIndex(nIdx),this._nodeIndexToLabel[nIdx].text);
				}
			}
		}
		captureGraph.layout(onLayoutFinished);

		return d.promise();
	}
});


exports.LINK_TYPE = _dereq_('./linkType');
exports.GroupingManager = _dereq_('./groupingManager');
exports.Layout = _dereq_('./layout');
exports.ColumnLayout = _dereq_('./columnLayout');
exports.RadialLayout = _dereq_('./radialLayout');
exports.Extend = _.extend;
exports.Graph = Graph;
},{"./columnLayout":1,"./groupingManager":2,"./layout":3,"./linkType":4,"./radialLayout":6,"./util":7}],6:[function(_dereq_,module,exports){
var _ = _dereq_('./util');
var Layout = _dereq_('./layout');
/**
 *
 * @param focus - the node at the center of the radial layout
 * @param distance - the distance of other nodes from the focus
 * @constructor
 */
function RadialLayout(focus,distance) {
	this._focus = focus;
	this._distance = distance;

	Layout.apply(this);
}


RadialLayout.prototype = _.extend(RadialLayout.prototype, Layout.prototype, {
	/**
	 * Gets/sets the distance parameter
	 * @param distance - the distance of links from the focus node to other nodes in pixels
	 * @returns {RadialLayout} if distance param is defined, {RadialLayout._distance} otherwise
	 */
	distance: function (distance) {
		if (distance) {
			this._distance = distance;
		} else {
			return this._distance;
		}
		return this;
	},

	/**
	 * Gets/sets the focus node that is at the center of the layout
	 * @param focus - the node that is at the center of the layout.   Other nodes are centered around this.
	 * @returns {RadialLayout} if focus param is defined, {RadialLayout._focus} otherwise
	 */
	focus: function (focus) {
		if (focus) {
			this._focus = focus;
		} else {
			return this._focus;
		}
		return this;
	},

	/**
	 * Get the label position for a node
	 * @param nodeX - the x position of the node
	 * @param nodeY - the y position of the node
	 * @param radius - the radius of the node
	 * @returns {{x: x position of the label, y: y position of the label, align: HTML canvas text alignment property for label}}
	 */
	layoutLabel: function (nodeX, nodeY, radius) {
		var x, y, align;

		// Right of center
		if (nodeX > this._focus) {
			x = nodeX + (radius + 10);
			align = 'start';
		} else {
			x = nodeX - (radius + 10);
			align = 'end';
		}

		if (nodeY > this._focus) {
			y = nodeY + (radius + 10);
		} else {
			y = nodeY - (radius + 10);
		}
		return {
			x: x,
			y: y,
			align: align
		};
	},

	/**
	 * Perform a radial layout
	 * @param w - the width of the canvas being rendered to
	 * @param h - the height of the canvas being rendered to
	 */
	layout: function (w, h) {
		var nodes = this.nodes();
		var that = this;
		var angleDelta = Math.PI * 2 / (nodes.length - 1);
		var angle = 0.0;
		nodes.forEach(function (node) {
			if (node.index === that._focus.index) {
				that._setNodePosition(node, node.x, node.y);
				return;
			}
			var newX = that._focus.x + (Math.cos(angle) * that._distance);
			var newY = that._focus.y + (Math.sin(angle) * that._distance);
			that._setNodePosition(node, newX, newY);
			angle += angleDelta;
		});
	}
});

module.exports = RadialLayout;

},{"./layout":3,"./util":7}],7:[function(_dereq_,module,exports){

var Util = {

  extend: function(dest, sources) {
    var key, i, source;
    for (i=1; i<arguments.length; i++) {
      source = arguments[i];
      for (key in source) {
        if (source.hasOwnProperty(key)) {
          dest[key] = source[key];
        }
      }
    }
    return dest;
  }
};

module.exports = Util;
},{}]},{},[5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2NvbHVtbkxheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2dyb3VwaW5nTWFuYWdlci5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2xheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2xpbmtUeXBlLmpzIiwiL1VzZXJzL2NkaWNrc29uL0RvY3VtZW50cy93b3Jrc3BhY2UvZ3JhcGhqcy9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL3JhZGlhbExheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25XQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcllBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxc0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIExheW91dCA9IHJlcXVpcmUoJy4vbGF5b3V0Jyk7XG5cbnZhciBDb2x1bW5MYXlvdXQgPSBmdW5jdGlvbigpIHtcblx0TGF5b3V0LmFwcGx5KHRoaXMpO1xufTtcblxuQ29sdW1uTGF5b3V0LnByb3RvdHlwZSA9IF8uZXh0ZW5kKENvbHVtbkxheW91dC5wcm90b3R5cGUsIExheW91dC5wcm90b3R5cGUsIHtcblxuXHQvKipcblx0ICogQSBjb2x1bW4gbGF5b3V0XG5cdCAqIEBwYXJhbSB3IC0gd2lkdGggb2YgY2FudmFzXG5cdCAqIEBwYXJhbSBoIC0gaGVpZ2h0IG9mIGNhbnZhc1xuXHQgKi9cblx0bGF5b3V0IDogZnVuY3Rpb24gKHcsIGgpIHtcblx0XHR2YXIgeCA9IDA7XG5cdFx0dmFyIHkgPSAwO1xuXHRcdHZhciBtYXhSYWRpdXNDb2wgPSAwO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG5cblx0XHRcdGlmICh5ID09PSAwKSB7XG5cdFx0XHRcdHkgKz0gbm9kZS5yYWRpdXM7XG5cdFx0XHR9XG5cdFx0XHRpZiAoeCA9PT0gMCkge1xuXHRcdFx0XHR4ICs9IG5vZGUucmFkaXVzO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGF0Ll9zZXROb2RlUG9zaXRpb25JbW1lZGlhdGUobm9kZSwgeCwgeSk7XG5cblx0XHRcdG1heFJhZGl1c0NvbCA9IE1hdGgubWF4KG1heFJhZGl1c0NvbCwgbm9kZS5yYWRpdXMpO1xuXG5cdFx0XHR5ICs9IG5vZGUucmFkaXVzICsgNDA7XG5cdFx0XHRpZiAoeSA+IGgpIHtcblx0XHRcdFx0eSA9IDA7XG5cdFx0XHRcdHggKz0gbWF4UmFkaXVzQ29sICsgNDA7XG5cdFx0XHRcdG1heFJhZGl1c0NvbCA9IDA7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbHVtbkxheW91dDtcbiIsInZhciBfID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGJhc2UgZ3JvdXBpbmcgbWFuYWdlci4gICBUaGlzIGlzIGFuIGFic3RyYWN0IGNsYXNzLiAgIENoaWxkIGNsYXNzZXMgc2hvdWxkIG92ZXJyaWRlIHRoZVxuICogaW5pdGlhbGl6ZUhlaXJhcmNoeSBmdW5jdGlvbiB0byBjcmVhdGUgbm9kZXMvbGlua3MgdGhhdCBhcmUgYWdncmVnYXRlZCBmb3IgdGhlaXIgc3BlY2lmaWMgaW1wbGVtZW50YXRpb25cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgR3JvdXBpbmdNYW5hZ2VyID0gZnVuY3Rpb24oYXR0cmlidXRlcykge1xuXHR0aGlzLl9pbml0aWFsaXplKCk7XG5cdF8uZXh0ZW5kKHRoaXMsYXR0cmlidXRlcyk7XG59O1xuXG5Hcm91cGluZ01hbmFnZXIucHJvdG90eXBlID0gXy5leHRlbmQoR3JvdXBpbmdNYW5hZ2VyLnByb3RvdHlwZSwge1xuXHRfaW5pdGlhbGl6ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX25vZGVzID0gW107XG5cdFx0dGhpcy5fbGlua3MgPSBbXTtcblxuXHRcdHRoaXMuX2FnZ3JlZ2F0ZWROb2RlcyA9IFtdO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZWRMaW5rcyA9IFtdO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZU5vZGVNYXAgPSB7fTtcblxuXHRcdHRoaXMuX3VuZ3JvdXBlZEFnZ3JlZ2F0ZXMgPSB7fTtcblx0XHR0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzID0ge307XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlc2V0IGhlaXJhcmNoeVxuXHQgKi9cblx0Y2xlYXIgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9pbml0aWFsaXplKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgb3JpZ2luYWwgbm9kZXMgaW4gdGhlIGdyYXBoIHdpdGhvdXQgZ3JvdXBpbmdcblx0ICogQHBhcmFtIG5vZGVzIC0gYSBncmFwaC5qcyBub2RlIGFycmF5XG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0bm9kZXMgOiBmdW5jdGlvbihub2Rlcykge1xuXHRcdGlmIChub2Rlcykge1xuXHRcdFx0dGhpcy5fbm9kZXMgPSBub2Rlcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX25vZGVzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBvcmlnaW5hbCBsaW5rcyBpbiB0aGUgZ3JhcGggd2l0aG91dCBncm91cGluZ1xuXHQgKiBAcGFyYW0gbGlua3MgLSBhIGdyYXBoLmpzIGxpbmsgYXJyYXlcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRsaW5rcyA6IGZ1bmN0aW9uKGxpbmtzKSB7XG5cdFx0aWYgKGxpbmtzKSB7XG5cdFx0XHR0aGlzLl9saW5rcyA9IGxpbmtzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGlua3M7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0aGUgbm9kZS9saW5rIGFnZ3JlZ2F0aW9uXG5cdCAqL1xuXHRpbml0aWFsaXplSGVpcmFyY2h5IDogZnVuY3Rpb24oKSB7XG5cblx0XHR0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzID0ge307XG5cdFx0dGhpcy5fdW5ncm91cGVkTm9kZUdyb3VwcyA9IHt9O1xuXG5cdFx0dGhpcy5fYWdncmVnYXRlTm9kZXMoKTtcblx0XHR0aGlzLl9hZ2dyZWdhdGVMaW5rcygpO1xuXG5cdFx0dmFyIHNldFBhcmVudFBvaW50ZXJzID0gZnVuY3Rpb24obm9kZSxwYXJlbnQpIHtcblx0XHRcdGlmIChub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdG5vZGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuXHRcdFx0XHRcdHNldFBhcmVudFBvaW50ZXJzKGNoaWxkLG5vZGUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdG5vZGUucGFyZW50Tm9kZSA9IHBhcmVudDtcblx0XHR9O1xuXG5cdFx0dGhpcy5fYWdncmVnYXRlZE5vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0c2V0UGFyZW50UG9pbnRlcnMobm9kZSxudWxsKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLm9uQWdncmVnYXRpb25Db21wbGV0ZSkge1xuXHRcdFx0dGhpcy5vbkFnZ3JlZ2F0aW9uQ29tcGxldGUoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4gYWdncmVnYXRlZCBsaW5rIGluIGdyYXBoLmpzIGZvcm1hdC4gICBDYW4gYmUgb3ZlcnJpZGVuIGJ5IHNwZWNpZmljIGltcGxlbWVudGF0aW9ucyB0byBhbGxvd1xuXHQgKiB0byBhbGxvdyBmb3IgZGlmZXJlbnQgbGluayB0eXBlcyBiYXNlZCBvbiBhZ2dyZWdhdGUgY29udGVudHNcblx0ICogQHBhcmFtIHNvdXJjZUFnZ3JlZ2F0ZSAtIHRoZSBzb3VyY2UgYWdncmVnYXRlIG5vZGVcblx0ICogQHBhcmFtIHRhcmdldEFnZ3JlZ2F0ZSAtIHRoZSB0YXJnZXQgYWdncmVnYXRlIG5vZGVcblx0ICogQHJldHVybnMge3tzb3VyY2U6ICosIHRhcmdldDogKn19IC0gYSBncmFwaC5qcyBsaW5rXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfY3JlYXRlQWdncmVnYXRlTGluayA6IGZ1bmN0aW9uKHNvdXJjZUFnZ3JlZ2F0ZSx0YXJnZXRBZ2dyZWdhdGUsb3JpZ2luYWxMaW5rcykge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzb3VyY2UgOiBzb3VyY2VBZ2dyZWdhdGUsXG5cdFx0XHR0YXJnZXQgOiB0YXJnZXRBZ2dyZWdhdGVcblx0XHR9O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBQZXJmb3JtcyBsaW5rIGFnZ3JlZ2F0ZSBiYXNlZCBvbiBhIHNldCBvZiBhZ2dyZWdhdGVkIG5vZGVzIGFuZCBhIGZ1bGwgc2V0IG9mIGxpbmtzXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfYWdncmVnYXRlTGlua3MgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZSA9IHt9O1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuZm9yRWFjaChmdW5jdGlvbihhZ2dyZWdhdGUpIHtcblx0XHRcdGlmIChhZ2dyZWdhdGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0YWdncmVnYXRlLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHRcdG5vZGVJbmRleFRvQWdncmVhZ2F0ZU5vZGVbbm9kZS5pbmRleF0gPSBhZ2dyZWdhdGU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVthZ2dyZWdhdGUuaW5kZXhdID0gYWdncmVnYXRlO1xuXHRcdFx0fVxuXHRcdFx0dGhhdC5fYWdncmVnYXRlTm9kZU1hcFthZ2dyZWdhdGUuaW5kZXhdID0gYWdncmVnYXRlO1xuXHRcdH0pO1xuXG5cblx0XHR2YXIgYWdncmVnYXRlZExpbmtzID0gW107XG5cblx0XHR2YXIgYWdncmVnYXRlTGlua01hcCA9IHt9O1xuXG5cdFx0dGhpcy5fbGlua3MuZm9yRWFjaChmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHR2YXIgc291cmNlQWdncmVnYXRlID0gbm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVtsaW5rLnNvdXJjZS5pbmRleF07XG5cdFx0XHR2YXIgdGFyZ2V0QWdncmVnYXRlID0gbm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVtsaW5rLnRhcmdldC5pbmRleF07XG5cblx0XHRcdGlmICghc291cmNlQWdncmVnYXRlIHx8ICF0YXJnZXRBZ2dyZWdhdGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgc291cmNlTWFwID0gYWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGUuaW5kZXhdO1xuXHRcdFx0aWYgKCFzb3VyY2VNYXApIHtcblx0XHRcdFx0c291cmNlTWFwID0ge307XG5cdFx0XHR9XG5cdFx0XHR2YXIgc291cmNlVG9UYXJnZXRMaW5rcyA9IHNvdXJjZU1hcFt0YXJnZXRBZ2dyZWdhdGUuaW5kZXhdO1xuXHRcdFx0aWYgKCFzb3VyY2VUb1RhcmdldExpbmtzKSB7XG5cdFx0XHRcdHNvdXJjZVRvVGFyZ2V0TGlua3MgPSBbXTtcblx0XHRcdH1cblx0XHRcdHNvdXJjZVRvVGFyZ2V0TGlua3MucHVzaChsaW5rKTtcblx0XHRcdHNvdXJjZU1hcFt0YXJnZXRBZ2dyZWdhdGUuaW5kZXhdID0gc291cmNlVG9UYXJnZXRMaW5rcztcblxuXHRcdFx0YWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGUuaW5kZXhdID0gc291cmNlTWFwO1xuXHRcdH0pO1xuXG5cdFx0Ly8gR2V0IG1pbi9tYXggbGluayBjb3VudHMgZm9yIGFsbCBhZ2dyZWdhdGUgcGFpcnNcblx0XHR2YXIgbWluQ291bnQgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXHRcdHZhciBtYXhDb3VudCA9IDA7XG5cdFx0Zm9yICh2YXIgc291cmNlQWdncmVnYXRlSWQgaW4gYWdncmVnYXRlTGlua01hcCkge1xuXHRcdFx0aWYgKGFnZ3JlZ2F0ZUxpbmtNYXAuaGFzT3duUHJvcGVydHkoc291cmNlQWdncmVnYXRlSWQpKSB7XG5cdFx0XHRcdGZvciAodmFyIHRhcmdldEFnZ3JlZ2F0ZUlkIGluIGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdKSB7XG5cdFx0XHRcdFx0aWYgKGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdLmhhc093blByb3BlcnR5KHRhcmdldEFnZ3JlZ2F0ZUlkKSkge1xuXHRcdFx0XHRcdFx0dmFyIHNvdXJjZSA9IHRoYXQuX2FnZ3JlZ2F0ZU5vZGVNYXBbc291cmNlQWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIHRhcmdldCA9IHRoYXQuX2FnZ3JlZ2F0ZU5vZGVNYXBbdGFyZ2V0QWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIG9yaWdpbmFsTGlua3MgPSBhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXVt0YXJnZXRBZ2dyZWdhdGVJZF07XG5cdFx0XHRcdFx0XHRtaW5Db3VudCA9IE1hdGgubWluKG1pbkNvdW50LG9yaWdpbmFsTGlua3MubGVuZ3RoKTtcblx0XHRcdFx0XHRcdG1heENvdW50ID0gTWF0aC5tYXgobWF4Q291bnQsb3JpZ2luYWxMaW5rcy5sZW5ndGgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAodmFyIHNvdXJjZUFnZ3JlZ2F0ZUlkIGluIGFnZ3JlZ2F0ZUxpbmtNYXApIHtcblx0XHRcdGlmIChhZ2dyZWdhdGVMaW5rTWFwLmhhc093blByb3BlcnR5KHNvdXJjZUFnZ3JlZ2F0ZUlkKSkge1xuXHRcdFx0XHRmb3IgKHZhciB0YXJnZXRBZ2dyZWdhdGVJZCBpbiBhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXSkge1xuXHRcdFx0XHRcdGlmIChhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXS5oYXNPd25Qcm9wZXJ0eSh0YXJnZXRBZ2dyZWdhdGVJZCkpIHtcblx0XHRcdFx0XHRcdHZhciBzb3VyY2UgPSB0aGF0Ll9hZ2dyZWdhdGVOb2RlTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXTtcblx0XHRcdFx0XHRcdHZhciB0YXJnZXQgPSB0aGF0Ll9hZ2dyZWdhdGVOb2RlTWFwW3RhcmdldEFnZ3JlZ2F0ZUlkXTtcblx0XHRcdFx0XHRcdHZhciBvcmlnaW5hbExpbmtzID0gYWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGVJZF1bdGFyZ2V0QWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIGxpbmsgPSB0aGF0Ll9jcmVhdGVBZ2dyZWdhdGVMaW5rKHNvdXJjZSwgdGFyZ2V0LCBvcmlnaW5hbExpbmtzLCBtaW5Db3VudCwgbWF4Q291bnQpO1xuXHRcdFx0XHRcdFx0aWYgKGxpbmspIHtcblx0XHRcdFx0XHRcdFx0YWdncmVnYXRlZExpbmtzLnB1c2gobGluayk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWdncmVnYXRlZExpbmtzID0gYWdncmVnYXRlZExpbmtzO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFBlcmZvcm0gbm9kZSBhZ2dyZWdhdGlvbi4gICBNdXN0IGJlIG92ZXJyaWRlbiBieSBpbXBsZW1lbnRvcnNcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9hZ2dyZWdhdGVOb2RlcyA6IGZ1bmN0aW9uKCkge1xuXG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGFnZ3JlZ2F0ZWQgbm9kZXNcblx0ICogQHJldHVybnMge0FycmF5fSBvZiBncmFwaC5qcyBub2Rlc1xuXHQgKi9cblx0YWdncmVnYXRlZE5vZGVzIDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcztcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgYWdncmVnYXRlZCBsaW5rc1xuXHQgKiBAcmV0dXJucyB7QXJyYXl9IG9mIGdyYXBoLmpzIGxpbmtzXG5cdCAqL1xuXHRhZ2dyZWdhdGVkTGlua3MgOiBmdW5jdGlvbigpICB7XG5cdFx0cmV0dXJuIHRoaXMuX2FnZ3JlZ2F0ZWRMaW5rcztcblx0fSxcblxuXHQvKipcblx0ICogUmVtb3ZlIGEgbm9kZSBmcm9tIHRoZSBoZXJpYXJjaHlcblx0ICogQHBhcmFtIG5vZGVcblx0ICovXG5cdHJlbW92ZSA6IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHR2YXIgaW5kZXggPSAtMTtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5sZW5ndGggJiYgaW5kZXggPT09IC0xOyBpKyspIHtcblx0XHRcdGlmICh0aGlzLl9hZ2dyZWdhdGVkTm9kZXNbaV0uaW5kZXggPT09IG5vZGUuaW5kZXgpIHtcblx0XHRcdFx0aW5kZXggPSBpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuc3BsaWNlKGluZGV4LDEpO1xuXHRcdH1cblx0fSxcblxuXG5cdC8qKlxuXHQgKiBEbyBhbnkgdXBkYXRlcyBvbiBjaGlsZHJlbiBiZWZvcmUgbGF5b3V0ICAoaWUvIHNldCBwb3NpdGlvbiwgcm93L2NvbCBpbmZvLCBldGMpLiAgIFNob3VsZCBiZSBkZWZpbmVkXG5cdCAqIGluIGltcGxlbWVudGluZyBjbGFzc1xuXHQgKiBAcGFyYW0gYWdncmVnYXRlXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfdXBkYXRlQ2hpbGRyZW4gOiBmdW5jdGlvbihhZ2dyZWdhdGUpIHtcblx0XHQvLyBzZXQgY2hpbGRyZW5zIHBvc2l0aW9uIGluaXRpYWxseSB0byB0aGUgcG9zaXRpb24gb2YgdGhlIGFnZ3JlZ2F0ZVxuXHRcdGFnZ3JlZ2F0ZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG5cdFx0XHRjaGlsZC54ID0gYWdncmVnYXRlLng7XG5cdFx0XHRjaGlsZC55ID0gYWdncmVnYXRlLnk7XG5cdFx0fSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVuZ3JvdXAgYW4gYWdncmVnYXRlIG5vZGVcblx0ICogQHBhcmFtIG5vZGVcblx0ICovXG5cdHVuZ3JvdXAgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4pIHtcblxuXHRcdFx0dmFyIHBhcmVudEtleSA9ICcnO1xuXHRcdFx0bm9kZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdFx0cGFyZW50S2V5ICs9IG5vZGUuaW5kZXggKyAnLCc7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fdW5ncm91cGVkQWdncmVnYXRlc1twYXJlbnRLZXldID0gbm9kZTtcblxuXHRcdFx0dmFyIGluZGV4ID0gLTE7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5sZW5ndGggJiYgaW5kZXggPT09IC0xOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlc1tpXS5pbmRleCA9PT0gbm9kZS5pbmRleCkge1xuXHRcdFx0XHRcdGluZGV4ID0gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl91cGRhdGVDaGlsZHJlbihub2RlKTtcblxuXHRcdFx0dmFyIGZpcnN0ID0gdGhpcy5fYWdncmVnYXRlZE5vZGVzLnNsaWNlKDAsaW5kZXgpO1xuXHRcdFx0dmFyIG1pZGRsZSA9IG5vZGUuY2hpbGRyZW47XG5cdFx0XHR0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzW3BhcmVudEtleV0gPSBub2RlLmNoaWxkcmVuO1xuXHRcdFx0dmFyIGVuZCA9IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5zbGljZShpbmRleCsxKTtcblxuXHRcdFx0dGhpcy5fYWdncmVnYXRlZE5vZGVzID0gZmlyc3QuY29uY2F0KG1pZGRsZSkuY29uY2F0KGVuZCk7XG5cblx0XHRcdC8vIFJlY29tcHV0ZSBhZ2dyZWdhdGVkIGxpbmtzXG5cdFx0XHR0aGlzLl9hZ2dyZWdhdGVMaW5rcygpO1xuXHRcdFx0cmV0dXJuIHBhcmVudEtleTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGFnZ3JlZ2F0ZSBub2RlIGZvciBhbiBleHBhbmRlZCBncm91cFxuXHQgKiBAcGFyYW0gYWdncmVnYXRlS2V5IC0ga2V5IHJldHVybmVkIGZyb20gdW5ncm91cFxuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdGdldEFnZ3JlZ2F0ZSA6IGZ1bmN0aW9uKGFnZ3JlZ2F0ZUtleSkge1xuXHRcdHJldHVybiB0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzW2FnZ3JlZ2F0ZUtleV07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlZ3JvdXBzIGFuIHVuZ3JvdXBlZCBhZ2dyZWdhdGVcblx0ICogQHBhcmFtIGFnZ3JlZ2F0ZUtleSAtIGtleSByZXR1cm5lZCBmcm9tIHVuZ3JvdXBcblx0ICogQHBhcmFtIGF0SW5kZXggLSByZWluc2VydHMgdGhlIGFnZ3JlZ2F0ZSBhdCBhIHNwZWNpZmljIHBvc2l0aW9uXG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0cmVncm91cCA6IGZ1bmN0aW9uKGFnZ3JlZ2F0ZUtleSxhdEluZGV4KSB7XG5cdFx0dmFyIGFnZ3JlZ2F0ZU5vZGUgPSB0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzW2FnZ3JlZ2F0ZUtleV07XG5cdFx0dmFyIG5vZGVzVG9SZW1vdmUgPSBhZ2dyZWdhdGVOb2RlLmNoaWxkcmVuO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRub2Rlc1RvUmVtb3ZlLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0dGhhdC5yZW1vdmUobm9kZSk7XG5cdFx0fSk7XG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5fYWdncmVnYXRlZE5vZGVzLnNsaWNlKDAsYXRJbmRleCk7XG5cdFx0dmFyIGVuZCA9IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5zbGljZShhdEluZGV4KTtcblx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMgPSBzdGFydC5jb25jYXQoYWdncmVnYXRlTm9kZSkuY29uY2F0KGVuZCk7XG5cdFx0dGhpcy5fYWdncmVnYXRlTGlua3MoKTtcblx0XHRkZWxldGUgdGhpcy5fdW5ncm91cGVkQWdncmVnYXRlc1thZ2dyZWdhdGVLZXldO1xuXHRcdGRlbGV0ZSB0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzW2FnZ3JlZ2F0ZUtleV07XG5cdFx0cmV0dXJuIGFnZ3JlZ2F0ZU5vZGU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYW4gYXJyYXkgb2Ygbm9kZSBncm91cHMgdGhhdCBhcmUgZXhwYW5kZWRcblx0ICogQHJldHVybnMge0FycmF5fVxuXHQgKi9cblx0Z2V0VW5ncm91cGVkTm9kZXMgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgaW5mbyA9IFtdO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRPYmplY3Qua2V5cyh0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0dmFyIG5vZGVzID0gdGhhdC5fdW5ncm91cGVkTm9kZUdyb3Vwc1trZXldO1xuXHRcdFx0dmFyIG5vZGVJbmRpY2VzID0gbm9kZXMubWFwKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGUuaW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdGluZm8ucHVzaCh7XG5cdFx0XHRcdGluZGljZXMgOiBub2RlSW5kaWNlcyxcblx0XHRcdFx0a2V5IDoga2V5XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRyZXR1cm4gaW5mbztcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyBhIGxpc3Qgb2YgdW5ncm91cGVkIG5vZGVzIGZvciBhbiBhZ2dyZWdhdGVcblx0ICogQHBhcmFtIGtleSAtIGtleSByZXR1cm5lZCBmcm9tIHVuZ3JvdXBcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRnZXRVbmdyb3VwZWROb2Rlc0ZvcktleSA6IGZ1bmN0aW9uKGtleSkge1xuXHRcdHJldHVybiB0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzW2tleV07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHgseSBwb3NpdGlvbiAocmVsYXRpdmUgdG8gZ3JvdXAgYm91bmRpbmcgYm94KSBmb3IgdGhlXG5cdCAqIHJlZ3JvdXAgKG1pbmltaXplKSBpY29uXG5cdCAqIEBwYXJhbSBib3VuZGluZ0JveCAtIGJvdW5kaW5nIGJveCBvZiBub2Rlc1xuXHQgKiBAcGFyYW0gdW5ncm91cGVkTm9kZXMgLSBjb2xsZWN0aW9uIG9mIHVuZ3JvdXBlZCBub2Rlc1xuXHQgKiBAcmV0dXJucyB7e3g6ICosIHk6ICp9fVxuXHQgKi9cblx0Z2V0TWluaW1pemVJY29uUG9zaXRpb24gOiBmdW5jdGlvbihib3VuZGluZ0JveCx1bmdyb3VwZWROb2Rlcykge1xuXHRcdHJldHVybiB7XG5cdFx0XHR4IDogYm91bmRpbmdCb3gueCArIGJvdW5kaW5nQm94LndpZHRoICsgMTAsXG5cdFx0XHR5IDogYm91bmRpbmdCb3gueVxuXHRcdH07XG5cdH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gR3JvdXBpbmdNYW5hZ2VyO1xuIiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBMYXlvdXQgY29uc3RydWN0b3JcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTGF5b3V0ID0gZnVuY3Rpb24oYXR0cmlidXRlcykge1xuXHR0aGlzLl9ub2RlcyA9IG51bGw7XG5cdHRoaXMuX2xpbmtNYXAgPSBudWxsO1xuXHR0aGlzLl9ub2RlTWFwID0gbnVsbDtcblx0dGhpcy5fbGFiZWxNYXAgPSBudWxsO1xuXHR0aGlzLl9kdXJhdGlvbiA9IDI1MDtcblx0dGhpcy5fZWFzaW5nID0gJ2Vhc2UtaW4tb3V0Jztcblx0dGhpcy5fem9vbVNjYWxlID0gMS4wO1xuXHR0aGlzLl9zY2VuZSA9IG51bGw7XG5cdHRoaXMuX2V2ZW50c1N1c3BlbmRlZCA9IGZhbHNlO1xuXHRfLmV4dGVuZCh0aGlzLGF0dHJpYnV0ZXMpO1xufTtcblxuTGF5b3V0LnByb3RvdHlwZSA9IF8uZXh0ZW5kKExheW91dC5wcm90b3R5cGUsIHtcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBkdXJhdGlvbiBvZiB0aGUgbGF5b3V0IGFuaW1hdGlvblxuXHQgKiBAcGFyYW0gZHVyYXRpb24gLSB0aGUgZHVyYXRpb24gb2YgdGhlIGxheW91dCBhbmltYXRpb24gaW4gbWlsbGlzZWNvbmRzLiAgKGRlZmF1bHQgPSAyNTBtcylcblx0ICogQHJldHVybnMge0xheW91dH0gaWYgZHVyYXRpb24gcGFyYW0gaXMgZGVmaW5lZCwge0xheW91dC5fZHVyYXRpb259IG90aGVyd2lzZVxuXHQgKi9cblx0ZHVyYXRpb24gOiBmdW5jdGlvbihkdXJhdGlvbikge1xuXHRcdGlmIChkdXJhdGlvbikge1xuXHRcdFx0dGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2R1cmF0aW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBlYXNpbmcgb2YgdGhlIGxheW91dCBhbmltYXRpb25cblx0ICogQHBhcmFtIGVhc2luZyAtIHRoZSBlYXNpbmcgb2YgdGhlIGxheW91dCBhbmltYXRpb24gaW4gbWlsbGlzZWNvbmRzLiAgKGRlZmF1bHQgPSAnZWFzZS1pbi1vdXQnKVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fSBpZiBlYXNpbmcgcGFyYW0gaXMgZGVmaW5lZCwge0xheW91dC5fZWFzaW5nfSBvdGhlcndpc2Vcblx0ICovXG5cdGVhc2luZyA6IGZ1bmN0aW9uKGVhc2luZykge1xuXHRcdGlmIChlYXNpbmcpIHtcblx0XHRcdHRoaXMuX2Vhc2luZyA9IGVhc2luZztcblx0XHR9XHQgZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZWFzaW5nO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBub2RlcyBvZiB0aGUgbGF5b3V0LiAgIFNldCBmcm9tIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbm9kZXMgLSB0aGUgc2V0IG9mIG5vZGVzIGRlZmluZWQgaW4gdGhlIGNvcnJlc3BvbmRpbmcgZ3JhcGhcblx0ICogQHJldHVybnMge0xheW91dH0gaWYgbm9kZXMgcGFyYW0gaXMgZGVmaW5lZCwge0xheW91dC5fbm9kZXN9IG90aGVyd2lzZVxuXHQgKi9cblx0bm9kZXMgOiBmdW5jdGlvbihub2Rlcykge1xuXHRcdGlmIChub2Rlcykge1xuXHRcdFx0dGhpcy5faXNVcGRhdGUgPSBub2RlcyA/IHRydWUgOiBmYWxzZTtcblx0XHRcdHRoaXMuX25vZGVzID0gbm9kZXM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9ub2Rlcztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbGluayBtYXAgb2YgdGhlIGxheW91dC4gICBTZXQgZnJvbSB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIGxpbmtNYXAgLSBhIG1hcCBmcm9tIG5vZGUgaW5kZXggdG8gYSBzZXQgb2YgbGluZXMgKHBhdGggb2JqZWN0cykgdGhhdCBjb250YWluIHRoYXQgbm9kZVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fSBpZiBsaW5rTWFwIHBhcmFtIGlzIGRlZmluZWQsIHtMYXlvdXQuX2xpbmtNYXB9IG90aGVyd2lzZVxuXHQgKi9cblx0bGlua01hcCA6IGZ1bmN0aW9uKGxpbmtNYXApIHtcblx0XHRpZiAobGlua01hcCkge1xuXHRcdFx0dGhpcy5fbGlua01hcCA9IGxpbmtNYXA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9saW5rTWFwO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBub2RlIG1hcCBvZiB0aGUgbGF5b3V0LiAgIFNldCBmcm9tIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbm9kZU1hcCAtIGEgbWFwIGZyb20gbm9kZSBpbmRleCB0byBhIGNpcmNsZSAocGF0aCBvYmplY3QpXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9IGlmIG5vZGVNYXAgcGFyYW0gaXMgZGVmaW5lZCwge0xheW91dC5fbm9kZU1hcH0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRub2RlTWFwIDogZnVuY3Rpb24obm9kZU1hcCkge1xuXHRcdGlmIChub2RlTWFwKSB7XG5cdFx0XHR0aGlzLl9ub2RlTWFwID0gbm9kZU1hcDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX25vZGVNYXA7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGxhYmVsIG9mIHRoZSBsYXlvdXQuICAgU2V0IGZyb20gdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSBsYWJlbE1hcCAtIGEgbWFwIGZyb20gbm9kZSBpbmRleCB0byBhIHRleHQgb2JqZWN0IChwYXRoIG9iamVjdClcblx0ICogQHJldHVybnMge0xheW91dH0gaWYgbGFiZWxNYXAgcGFyYW0gaXMgZGVmaW5lZCwge0xheW91dC5fbGFiZWxNYXB9IG90aGVyd2lzZVxuXHQgKi9cblx0bGFiZWxNYXAgOiBmdW5jdGlvbihsYWJlbE1hcCkge1xuXHRcdGlmIChsYWJlbE1hcCkge1xuXHRcdFx0dGhpcy5fbGFiZWxNYXAgPSBsYWJlbE1hcDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xhYmVsTWFwO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRzY2VuZSA6IGZ1bmN0aW9uKHNjZW5lKSB7XG5cdFx0aWYgKHNjZW5lKSB7XG5cdFx0XHR0aGlzLl9zY2VuZSA9IHNjZW5lO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2NlbmU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgYm91bmRpbmcgYm94IGZvciBhbiBhcnJheSBvZiBub2RlIGluZGljZXNcblx0ICogQHBhcmFtIG5vZGVPckluZGV4QXJyYXkgLSBhcnJheSBvZiBub2RlIGluZGljaWVzIG9yIG5vZGUgYXJyYXkgaXRzZWxmXG5cdCAqIEBwYXJhbSBwYWRkaW5nIC0gcGFkZGluZyBpbiBwaXhlbHMgYXBwbGllZCB0byBib3VuZGluZyBib3hcblx0ICogQHJldHVybnMge3ttaW46IHt4OiBOdW1iZXIsIHk6IE51bWJlcn0sIG1heDoge3g6IG51bWJlciwgeTogbnVtYmVyfX19XG5cdCAqL1xuXHRnZXRCb3VuZGluZ0JveCA6IGZ1bmN0aW9uKG5vZGVPckluZGV4QXJyYXkscGFkZGluZyxiSW5jbHVkZUxhYmVscykge1xuXHRcdGlmICghbm9kZU9ySW5kZXhBcnJheSB8fCAhbm9kZU9ySW5kZXhBcnJheS5sZW5ndGggfHwgbm9kZU9ySW5kZXhBcnJheS5sZW5ndGggPT09IDAgfHwgT2JqZWN0LmtleXModGhpcy5fbm9kZU1hcCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR4IDogMCxcblx0XHRcdFx0eSA6IDAsXG5cdFx0XHRcdHdpZHRoIDogMSxcblx0XHRcdFx0aGVpZ2h0IDogMVxuXHRcdFx0fTtcblx0XHR9XG5cblxuXHRcdHZhciBtaW4gPSB7XG5cdFx0XHR4IDogTnVtYmVyLk1BWF9WQUxVRSxcblx0XHRcdHkgOiBOdW1iZXIuTUFYX1ZBTFVFXG5cdFx0fTtcblx0XHR2YXIgbWF4ID0ge1xuXHRcdFx0eCA6IC1OdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0eSA6IC1OdW1iZXIuTUFYX1ZBTFVFXG5cdFx0fTtcblxuXHRcdHZhciBiYlBhZGRpbmcgPSBwYWRkaW5nIHx8IDA7XG5cblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0bm9kZU9ySW5kZXhBcnJheS5mb3JFYWNoKGZ1bmN0aW9uKG5vZGVPckluZGV4KSB7XG5cdFx0XHR2YXIgaWR4ID0gbm9kZU9ySW5kZXggaW5zdGFuY2VvZiBPYmplY3QgPyBub2RlT3JJbmRleC5pbmRleCA6IG5vZGVPckluZGV4O1xuXHRcdFx0dmFyIGNpcmNsZSA9IHRoYXQuX25vZGVNYXBbaWR4XTtcblx0XHRcdG1pbi54ID0gTWF0aC5taW4obWluLngsIChjaXJjbGUuZmluYWxYIHx8IGNpcmNsZS54KSAtIChjaXJjbGUucmFkaXVzICsgYmJQYWRkaW5nKSk7XG5cdFx0XHRtaW4ueSA9IE1hdGgubWluKG1pbi55LCAoY2lyY2xlLmZpbmFsWSB8fCBjaXJjbGUueSkgLSAoY2lyY2xlLnJhZGl1cyArIGJiUGFkZGluZykpO1xuXHRcdFx0bWF4LnggPSBNYXRoLm1heChtYXgueCwgKGNpcmNsZS5maW5hbFggfHwgY2lyY2xlLngpICsgKGNpcmNsZS5yYWRpdXMgKyBiYlBhZGRpbmcpKTtcblx0XHRcdG1heC55ID0gTWF0aC5tYXgobWF4LnksIChjaXJjbGUuZmluYWxZIHx8IGNpcmNsZS55KSArIChjaXJjbGUucmFkaXVzICsgYmJQYWRkaW5nKSk7XG5cdFx0fSk7XG5cblx0XHRpZiAoYkluY2x1ZGVMYWJlbHMpIHtcblx0XHRcdE9iamVjdC5rZXlzKHRoaXMuX2xhYmVsTWFwKS5mb3JFYWNoKGZ1bmN0aW9uKG5vZGVJbmRleCkge1xuXHRcdFx0XHR2YXIgbGFiZWwgPSB0aGF0Ll9sYWJlbE1hcFtub2RlSW5kZXhdO1xuXHRcdFx0XHR2YXIgbWVhc3VyZW1lbnRzID0gdGhhdC5fc2NlbmUubWVhc3VyZShsYWJlbCk7XG5cdFx0XHRcdHZhciBtaW54LG1pbnksbWF4eCxtYXh5O1xuXHRcdFx0XHRpZiAobGFiZWwudGV4dEFsaWduID09PSAnc3RhcnQnIHx8IGxhYmVsLnRleHRBbGlnbiA9PT0gJ2xlZnQnIHx8ICFsYWJlbC50ZXh0QWxpZ24pIHtcblx0XHRcdFx0XHRtaW54ID0gbGFiZWwueDtcblx0XHRcdFx0XHRtYXh4ID0gbWlueCArIG1lYXN1cmVtZW50cy53aWR0aDtcblx0XHRcdFx0fSBlbHNlIGlmIChsYWJlbC50ZXh0QWxpZ24gPT09ICdjZW50ZXInKSB7XG5cdFx0XHRcdFx0bWlueCA9IGxhYmVsLnggLSBtZWFzdXJlbWVudHMud2lkdGgvMjtcblx0XHRcdFx0XHRtYXh4ID0gbGFiZWwueCArIG1lYXN1cmVtZW50cy53aWR0aC8yO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGxhYmVsLnRleHRBbGlnbiA9PT0gJ2VuZCcgfHwgbGFiZWwudGV4dEFsaWduID09PSAncmlnaHQnKSB7XG5cdFx0XHRcdFx0bWlueCA9IGxhYmVsLnggLSBtZWFzdXJlbWVudHMud2lkdGg7XG5cdFx0XHRcdFx0bWF4eCA9IGxhYmVsLng7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1pbnkgPSBsYWJlbC55IC0gbWVhc3VyZW1lbnRzLmhlaWdodDtcblx0XHRcdFx0bWF4eSA9IGxhYmVsLnk7XG5cblx0XHRcdFx0bWluLnggPSBNYXRoLm1pbihtaW4ueCxtaW54KTtcblx0XHRcdFx0bWluLnkgPSBNYXRoLm1pbihtaW4ueSxtaW55KTtcblx0XHRcdFx0bWF4LnggPSBNYXRoLm1heChtYXgueCxtYXh4KTtcblx0XHRcdFx0bWF4LnkgPSBNYXRoLm1heChtYXgueSxtYXh5KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0eCA6IG1pbi54LFxuXHRcdFx0eSA6IG1pbi55LFxuXHRcdFx0d2lkdGggOiAobWF4LnggLSBtaW4ueCksXG5cdFx0XHRoZWlnaHQgOiAobWF4LnkgLSBtaW4ueSlcblx0XHR9O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHdoZXRoZXJlIHdlIHNob3VsZCBhcHBseSB6b29tIHdoZW4gcGVyZm9ybWluZyBhIGxheW91dC4gICBTaG91bGQgbmV2ZXIgYmVcblx0ICogY2FsbGVkIGJ5IHVzZXJcblx0ICogQHBhcmFtIGJBcHBseVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fVxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2FwcGx5Wm9vbVNjYWxlIDogZnVuY3Rpb24oYkFwcGx5KSB7XG5cdFx0dGhpcy5fYXBwbHlab29tID0gYkFwcGx5O1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBwb3NpdGlvbiBvZiBhIG5vZGUgYW5kIGFsbCBhdHRhY2hlZCBsaW5rcyBhbmQgbGFiZWxzIHdpdGhvdXQgYW5pbWF0aW9uXG5cdCAqIEBwYXJhbSBub2RlIC0gdGhlIG5vZGUgb2JqZWN0IGJlaW5nIHBvc2l0aW9uZWRcblx0ICogQHBhcmFtIHggLSB0aGUgbmV3IHggcG9zaXRpb24gZm9yIHRoZSBub2RlXG5cdCAqIEBwYXJhbSB5IC0gdGhlIG5ldyB5IHBvc2l0aW9uIGZvciB0aGUgbm9kZVxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3NldE5vZGVQb3NpdGlvbkltbWVkaWF0ZSA6IGZ1bmN0aW9uKG5vZGUseCx5LGNhbGxiYWNrKSB7XG5cdFx0dGhpcy5fc2V0Tm9kZVBvc2l0aW9uKG5vZGUseCx5LHRydWUpO1xuXHRcdGlmIChjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHBvc2l0aW9uIG9mIGEgbm9kZSBieSBhbmltYXRpbmcgZnJvbSBpdCdzIG9sZCBwb3NpdGlvbiB0byBpdCdzIG5ldyBvbmVcblx0ICogQHBhcmFtIG5vZGUgLSB0aGUgbm9kZSBiZWluZyByZXBvc2l0aW9uZWRcblx0ICogQHBhcmFtIHggLSB0aGUgbmV3IHggcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIHkgLSB0aGUgbmV3IHkgcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIGJJbW1lZGlhdGUgLSBpZiB0cnVlLCBzZXRzIHdpdGhvdXQgYW5pbWF0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3NldE5vZGVQb3NpdGlvbiA6IGZ1bmN0aW9uKG5vZGUsbmV3WCxuZXdZLGJJbW1lZGlhdGUsY2FsbGJhY2spIHtcblx0XHR2YXIgeCA9IG5ld1ggKiAodGhpcy5fYXBwbHlab29tID8gdGhpcy5fem9vbVNjYWxlIDogMSk7XG5cdFx0dmFyIHkgPSBuZXdZICogKHRoaXMuX2FwcGx5Wm9vbSA/IHRoaXMuX3pvb21TY2FsZSA6IDEpO1xuXG5cblx0XHQvLyBVcGRhdGUgdGhlIG5vZGUgcmVuZGVyIG9iamVjdFxuXHRcdHZhciBjaXJjbGUgPSB0aGlzLl9ub2RlTWFwW25vZGUuaW5kZXhdO1xuXHRcdGlmIChiSW1tZWRpYXRlIT09dHJ1ZSkge1xuXHRcdFx0Y2lyY2xlLnR3ZWVuQXR0cih7XG5cdFx0XHRcdHg6IHgsXG5cdFx0XHRcdHk6IHlcblx0XHRcdH0sIHtcblx0XHRcdFx0ZHVyYXRpb246IHRoaXMuX2R1cmF0aW9uLFxuXHRcdFx0XHRlYXNpbmc6IHRoaXMuX2Vhc2luZyxcblx0XHRcdFx0Y2FsbGJhY2sgOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRkZWxldGUgY2lyY2xlLmZpbmFsWDtcblx0XHRcdFx0XHRkZWxldGUgY2lyY2xlLmZpbmFsWTtcblx0XHRcdFx0XHRub2RlLnggPSB4O1xuXHRcdFx0XHRcdG5vZGUueSA9IHk7XG5cdFx0XHRcdFx0aWYgKGNhbGxiYWNrKSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjaXJjbGUuZmluYWxYID0geDtcblx0XHRcdGNpcmNsZS5maW5hbFkgPSB5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjaXJjbGUueCA9IHg7XG5cdFx0XHRjaXJjbGUueSA9IHk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9saW5rTWFwW25vZGUuaW5kZXhdLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bm9kZS54ID0geDtcblx0XHRcdG5vZGUueSA9IHk7XG5cdFx0XHRjaXJjbGUueCA9IHg7XG5cdFx0XHRjaXJjbGUueSA9IHk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRoZSBsYWJlbCByZW5kZXIgb2JqZWN0XG5cdFx0dmFyIGxhYmVsID0gdGhpcy5fbGFiZWxNYXBbbm9kZS5pbmRleF07XG5cdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHR2YXIgbGFiZWxQb3MgPSB0aGlzLmxheW91dExhYmVsKGNpcmNsZSk7XG5cdFx0XHRpZiAoYkltbWVkaWF0ZSE9PXRydWUpIHtcblx0XHRcdFx0bGFiZWwudHdlZW5BdHRyKGxhYmVsUG9zLCB7XG5cdFx0XHRcdFx0ZHVyYXRpb246IHRoaXMuX2R1cmF0aW9uLFxuXHRcdFx0XHRcdGVhc2luZzogdGhpcy5fZWFzaW5nXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yICh2YXIgcHJvcCBpbiBsYWJlbFBvcykge1xuXHRcdFx0XHRcdGlmIChsYWJlbFBvcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuXHRcdFx0XHRcdFx0bGFiZWxbcHJvcF0gPSBsYWJlbFBvc1twcm9wXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdC8vIFVwZGF0ZSB0aGUgbGluayByZW5kZXIgb2JqZWN0XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX2xpbmtNYXBbbm9kZS5pbmRleF0uZm9yRWFjaChmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHR2YXIgbGlua09iaktleSA9IG51bGw7XG5cdFx0XHRpZiAobGluay5zb3VyY2UuaW5kZXggPT09IG5vZGUuaW5kZXgpIHtcblx0XHRcdFx0bGlua09iaktleSA9ICdzb3VyY2UnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGlua09iaktleSA9ICd0YXJnZXQnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGJJbW1lZGlhdGUhPT10cnVlKSB7XG5cdFx0XHRcdGxpbmsudHdlZW5PYmoobGlua09iaktleSwge1xuXHRcdFx0XHRcdHg6IHgsXG5cdFx0XHRcdFx0eTogeVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0ZHVyYXRpb246IHRoYXQuX2R1cmF0aW9uLFxuXHRcdFx0XHRcdGVhc2luZzogdGhhdC5fZWFzaW5nXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGlua1tsaW5rT2JqS2V5XS54ID0geDtcblx0XHRcdFx0bGlua1tsaW5rT2JqS2V5XS55ID0geTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSxcblxuXHQvKipcblx0ICogTGF5b3V0IGhhbmRsZXIuICAgQ2FsbHMgaW1wbGVtZW50aW5nIGxheW91dCByb3V0aW5lIGFuZCBwcm92aWRlcyBhIGNhbGxiYWNrIGlmIGl0J3MgYXN5bmNcblx0ICogQHBhcmFtIHcgLSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhcyBiZWluZyByZW5kZXJlZCB0b1xuXHQgKiBAcGFyYW0gaCAtIHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyBiZWluZyByZW5kZXJlZCB0b1xuXHQgKiBAcmV0dXJucyB7TGF5b3V0fVxuXHQgKi9cblx0bGF5b3V0IDogZnVuY3Rpb24odyxoLGNhbGxiYWNrKSB7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGZ1bmN0aW9uIG9uQ29tcGxldGUoKSB7XG5cdFx0XHR0aGF0Ll9ldmVudHNTdXNwZW5kZWQgPSBmYWxzZTtcblx0XHRcdGlmIChjYWxsYmFjaykge1xuXHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2V2ZW50c1N1c3BlbmRlZCA9IHRydWU7XG5cdFx0dmFyIGlzQXN5bmMgPSAhdGhpcy5fcGVyZm9ybUxheW91dCh3LGgpO1xuXHRcdGlmIChpc0FzeW5jKSB7XG5cdFx0XHRzZXRUaW1lb3V0KG9uQ29tcGxldGUsdGhpcy5kdXJhdGlvbigpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b25Db21wbGV0ZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogRGVmYXVsdCBsYXlvdXQgdGhhdCBkb2VzIG5vdGhpbmcuICAgU2hvdWxkIGJlIG92ZXJyaWRlblxuXHQgKiBAcGFyYW0gd1xuXHQgKiBAcGFyYW0gaFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3BlcmZvcm1MYXlvdXQgOiBmdW5jdGlvbih3LGgpIHtcblxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFx0LyoqXG5cdCAqIEhvb2sgZm9yIGRvaW5nIGFueSBkcmF3aW5nIGJlZm9yZSByZW5kZXJpbmcgb2YgdGhlIGdyYXBoIHRoYXQgaXMgbGF5b3V0IHNwZWNpZmljXG5cdCAqIGllLyBCYWNrZ3JvdW5kcywgZXRjXG5cdCAqIEBwYXJhbSB3IC0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXNcblx0ICogQHBhcmFtIGggLSB0aGUgaGVpZ2h0IG9mIHRoZSBjYW52YXNcblx0ICogQHJldHVybnMge0FycmF5fSAtIGEgbGlzdCBvZiBwYXRoLmpzIHJlbmRlciBvYmplY3RzIHRvIGJlIGFkZGVkIHRvIHRoZSBzY2VuZVxuXHQgKi9cblx0cHJlcmVuZGVyIDogZnVuY3Rpb24odyxoKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBIb29rIGZvciBkb2luZyBhbnkgZHJhd2luZyBhZnRlciByZW5kZXJpbmcgb2YgdGhlIGdyYXBoIHRoYXQgaXMgbGF5b3V0IHNwZWNpZmljXG5cdCAqIGllLyBPdmVybGF5cywgZXRjXG5cdCAqIEBwYXJhbSB3IC0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXNcblx0ICogQHBhcmFtIGggLSB0aGUgaGVpZ2h0IG9mIHRoZSBjYW52YXNcblx0ICogQHJldHVybnMge0FycmF5fSAtIGEgbGlzdCBvZiBwYXRoLmpzIHJlbmRlciBvYmplY3RzIHRvIGJlIGFkZGVkIHRvIHRoZSBzY2VuZVxuXHQgKi9cblx0cG9zdHJlbmRlciA6IGZ1bmN0aW9uKHcsaCkge1xuXHRcdHJldHVybiBbXTtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGJhY2sgZm9yIHVwZGF0aW5nIHBvc3QgcmVuZGVyIG9iamVjdHMuICAgVXN1YWxseSByZW5kZXJlZCBpbiBzY3JlZW5zcGFjZVxuXHQgKiBAcGFyYW0gbWlueCAtIG1pbiB4IGNvb3JkaW5hdGUgb2Ygc2NyZWVuXG5cdCAqIEBwYXJhbSBtaW55IC0gbWluIHkgY29vcmRpbmF0ZSBvZiBzY3JlZW5cblx0ICogQHBhcmFtIG1heHggLSBtYXggeCBjb29yZGluYXRlIG9mIHNjcmVlblxuXHQgKiBAcGFyYW0gbWF4eSAtIG1heCB5IGNvb3JkaW5hdGUgb2Ygc2NyZWVuXG5cdCAqL1xuXHRwb3N0cmVuZGVyVXBkYXRlIDogZnVuY3Rpb24obWlueCxtaW55LG1heHgsbWF4eSkge1xuXG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGxhYmVsIHBvc2l0aW9uIGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVYIC0gdGhlIHggcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIG5vZGVZIC0gdGhlIHkgcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIHJhZGl1cyAtIHRoZSByYWRpdXMgb2YgdGhlIG5vZGVcblx0ICogQHJldHVybnMge3t4OiB4IHBvc2l0aW9uIG9mIHRoZSBsYWJlbCwgeTogeSBwb3NpdGlvbiBvZiB0aGUgbGFiZWx9fVxuXHQgKi9cblx0bGF5b3V0TGFiZWwgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHg6IG5vZGUueCArIG5vZGUucmFkaXVzICsgNSxcblx0XHRcdHk6IG5vZGUueSArIG5vZGUucmFkaXVzICsgNVxuXHRcdH07XG5cdH1cbn0pO1xuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBMYXlvdXQ7XG4iLCJ2YXIgTElOS19UWVBFID0ge1xuXHRERUZBVUxUIDogJ2xpbmUnLFxuXHRMSU5FIDogJ2xpbmUnLFxuXHRBUlJPVyA6ICdhcnJvdycsXG5cdEFSQyA6ICdhcmMnXG59O1xubW9kdWxlLmV4cG9ydHMgPSBMSU5LX1RZUEU7IiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBMSU5LX1RZUEUgPSByZXF1aXJlKCcuL2xpbmtUeXBlJyk7XG52YXIgTGF5b3V0ID0gcmVxdWlyZSgnLi9sYXlvdXQnKTtcblxudmFyIFJFR1JPVU5EX0JCX1BBRERJTkcgPSAwO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBHcmFwaCByZW5kZXIgb2JqZWN0XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEdyYXBoID0gZnVuY3Rpb24oYXR0cmlidXRlcykge1xuXHR0aGlzLl9ub2RlcyA9IFtdO1xuXHR0aGlzLl9saW5rcyA9IFtdO1xuXHR0aGlzLl9jYW52YXMgPSBudWxsO1xuXHR0aGlzLl9sYXlvdXRlciA9IG51bGw7XG5cdHRoaXMuX2dyb3VwaW5nTWFuYWdlciA9IG51bGw7XG5cdHRoaXMuX3dpZHRoID0gMDtcblx0dGhpcy5faGVpZ2h0ID0gMDtcblx0dGhpcy5fem9vbVNjYWxlID0gMS4wO1xuXHR0aGlzLl96b29tTGV2ZWwgPSAwO1xuXHR0aGlzLl9zY2VuZSA9IG51bGw7XG5cdHRoaXMuX3Nob3dBbGxMYWJlbHMgPSBmYWxzZTtcblx0dGhpcy5fcHJlcmVuZGVyR3JvdXAgPSBudWxsO1xuXHR0aGlzLl9wb3N0cmVuZGVyR3JvdXAgPSBudWxsO1xuXHR0aGlzLl9wYW5uYWJsZSA9IG51bGw7XG5cdHRoaXMuX3pvb21hYmxlID0gbnVsbDtcblx0dGhpcy5fZHJhZ2dhYmxlID0gbnVsbDtcblx0dGhpcy5fY3VycmVudE92ZXJOb2RlID0gbnVsbDtcblx0dGhpcy5fY3VycmVudE1vdmVTdGF0ZSA9IG51bGw7XG5cdHRoaXMuX2ludmVydGVkUGFuID0gMTtcblxuXHR0aGlzLl9mb250U2l6ZSA9IG51bGw7XG5cdHRoaXMuX2ZvbnRGYW1pbHkgPSBudWxsO1xuXHR0aGlzLl9mb250Q29sb3IgPSBudWxsO1xuXHR0aGlzLl9mb250U3Ryb2tlID0gbnVsbDtcblx0dGhpcy5fZm9udFN0cm9rZVdpZHRoID0gbnVsbDtcblx0dGhpcy5fc2hhZG93Q29sb3IgPSBudWxsO1xuXHR0aGlzLl9zaGFkb3dPZmZzZXRYID0gbnVsbDtcblx0dGhpcy5fc2hhZG93T2Zmc2V0WSA9IG51bGw7XG5cdHRoaXMuX3NoYWRvd0JsdXIgPSBudWxsO1xuXG5cdC8vIERhdGEgdG8gcmVuZGVyIG9iamVjdCBtYXBzXG5cdHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmUgPSB7fTtcblx0dGhpcy5fbm9kZUluZGV4VG9DaXJjbGUgPSB7fTtcblx0dGhpcy5fbm9kZUluZGV4VG9MYWJlbCA9IHt9O1xuXG5cdF8uZXh0ZW5kKHRoaXMsYXR0cmlidXRlcyk7XG59O1xuXG5HcmFwaC5wcm90b3R5cGUgPSBfLmV4dGVuZChHcmFwaC5wcm90b3R5cGUsIHtcblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbm9kZXMgZm9yIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbm9kZXMgLSBhbiBhcnJheSBvZiBub2Rlc1xuXHQgKiB7XG5cdCAqIFx0XHR4IDogdGhlIHggY29vcmRpbmF0ZSBvZiB0aGUgbm9kZVx0KHJlcXVpcmVkKVxuXHQgKiBcdFx0eSA6IHRoZSB5IGNvb3JkaW5hdGUgb2YgdGhlIG5vZGVcdChyZXF1aXJlZClcblx0ICpcdFx0aW5kZXggOiAgYSB1bmlxdWUgaW5kZXhcdFx0XHRcdChyZXF1aXJlZClcblx0ICpcdFx0bGFiZWwgOiBhIGxhYmVsIGZvciB0aGUgbm9kZVx0XHQob3B0aW9uYWwpXG5cdCAqXHRcdGZpbGxTdHlsZSA6IGEgY2FudmFzIGZpbGwgICBcdFx0KG9wdGlvbmFsLCBkZWZhdWx0ICMwMDAwMDApXG5cdCAqXHRcdHN0cm9rZVN0eWxlIDogYSBjYW52YXMgc3Ryb2tlXHRcdChvcHRpb25hbCwgZGVmYXVsdCB1bmRlZmluZWQpXG5cdCAqXHRcdGxpbmVXaWR0aCA6IHdpZHRoIG9mIHRoZSBzdHJva2VcdFx0KG9wdGlvbmFsLCBkZWZhdWx0IDEpXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgbm9kZXMgcGFyYW1ldGVyIGlzIGRlZmluZWQsIHtHcmFwaC5fbm9kZXN9IG90aGVyd2lzZVxuXHQgKi9cblx0bm9kZXMgOiBmdW5jdGlvbihub2Rlcykge1xuXHRcdGlmIChub2Rlcykge1xuXHRcdFx0dGhpcy5fbm9kZXMgPSBub2RlcztcblxuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSA9IHt9O1xuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9DaXJjbGUgPSB7fTtcblx0XHRcdHRoaXMuX25vZGVJbmRleFRvTGFiZWwgPSB7fTtcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdG5vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHR0aGF0Ll9ub2RlSW5kZXhUb0xpbmtMaW5lW25vZGUuaW5kZXhdID0gW107fSk7XG5cdFx0XHRpZiAodGhpcy5fbGF5b3V0ZXIpIHtcblx0XHRcdFx0dGhpcy5fbGF5b3V0ZXIubm9kZXMobm9kZXMpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9ub2Rlcztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCBub2RlIHJlbmRlciBvYmplY3Rcblx0ICogQHBhcmFtIG5vZGVJbmRleCAtIGluZGV4IG9mIHRoZSBub2RlXG5cdCAqIEByZXR1cm5zIHBhdGhqcyBjaXJjbGUgb2JqZWN0XG5cdCAqL1xuXHRub2RlV2l0aEluZGV4IDogZnVuY3Rpb24obm9kZUluZGV4KSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlW25vZGVJbmRleF07XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCBsYWJlbCByZW5kZXIgb2JqZWN0IGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVJbmRleCAtIGluZGV4IG9mIHRoZSBub2RlXG5cdCAqIEByZXR1cm5zIHBhdGhqcyByZW5kZXIgb2JqZWN0XG5cdCAqL1xuXHRsYWJlbFdpdGhJbmRleCA6IGZ1bmN0aW9uKG5vZGVJbmRleCkge1xuXHRcdHJldHVybiB0aGlzLl9ub2RlSW5kZXhUb0xhYmVsW25vZGVJbmRleF07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwZGF0ZSB0aGUgcmVuZGVyIHByb3BlcnRpZXMgb2YgYSBub2RlXG5cdCAqIEBwYXJhbSBub2RlSW5kZXggLSBpbmRleCBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gcHJvcHMgLSBhbnkgcGF0aGpzIHByb3BlcnRpZXMgd2Ugd2lzaCB0byB1cGRhdGVcblx0ICovXG5cdHVwZGF0ZU5vZGUgOiBmdW5jdGlvbihub2RlSW5kZXgscHJvcHMpIHtcblx0XHQvLyBUT0RPOiAgcmVtb3ZlIG11Y2tpbmcgd2l0aCBwb3NpdGlvbiBzZXR0aW5ncyBmcm9tIHByb3BzP1xuXHRcdGlmIChub2RlSW5kZXgpIHtcblx0XHRcdHZhciBjaXJjbGUgPSB0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZVtub2RlSW5kZXhdO1xuXHRcdFx0Y2lyY2xlID0gXy5leHRlbmQoY2lyY2xlLHByb3BzKTtcblx0XHRcdHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlW25vZGVJbmRleF0gPSBjaXJjbGU7XG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSByZW5kZXIgcHJvcGVydGllcyBvZiBhIGxhYmVsXG5cdCAqIEBwYXJhbSBub2RlSW5kZXggLSBpbmRleCBvZiB0aGUgbm9kZSB0aGlzIGxhYmVsIGlzIGF0dGFjaGVkIHRvXG5cdCAqIEBwYXJhbSBwcm9wcyAtIGFueSBwYXRoanMgcHJvcGVydGllcnMgd2Ugd2l0aCB0byB1cGRhdGVcblx0ICovXG5cdHVwZGF0ZUxhYmVsIDogZnVuY3Rpb24obm9kZUluZGV4LHByb3BzKSB7XG5cdFx0Ly8gVE9ETzogIHJlbW92ZSBtdWNraW5nIHdpdGggcG9zaXRpb24gc2V0dGluZ3MgZnJvbSBwcm9wcz9cblx0XHRpZiAobm9kZUluZGV4KSB7XG5cdFx0XHR2YXIgdGV4dCA9IHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZUluZGV4XTtcblx0XHRcdHRleHQgPSBfLmV4dGVuZCh0ZXh0LHByb3BzKTtcblx0XHRcdHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZUluZGV4XSA9IHRleHQ7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbm9kZXMgZm9yIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbGlua3MgLSBhbiBhcnJheSBvZiBsaW5rc1xuXHQgKiB7XG5cdCAqIFx0XHRzb3VyY2UgOiBhIG5vZGUgb2JqZWN0IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNvdXJjZSBcdChyZXF1aXJlZClcblx0ICogXHRcdHRhcmdldCA6IGEgbm9kZSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGUgdGFyZ2V0XHQocmVxdWlyZWQpXG5cdCAqXHRcdHN0cm9rZVN0eWxlIDogYSBjYW52YXMgc3Ryb2tlXHRcdFx0XHRcdFx0KG9wdGlvbmFsLCBkZWZhdWx0ICMwMDAwMDApXG5cdCAqXHRcdGxpbmVXaWR0aCA6IHRoZSB3aWR0aCBvZiB0aGUgc3Ryb2tlXHRcdFx0XHRcdChvcHRpbmFsLCBkZWZhdWx0IDEpXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgbGlua3MgcGFyYW1ldGVyIGlzIGRlZmluZWQsIHtHcmFwaC5fbGlua3N9IG90aGVyd2lzZVxuXHQgKi9cblx0bGlua3MgOiBmdW5jdGlvbihsaW5rcykge1xuXHRcdGlmIChsaW5rcykge1xuXHRcdFx0dGhpcy5fbGlua3MgPSBsaW5rcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xpbmtzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cyB0aGUgbGlua3MgYmV0d2VlbiB0d28gbm9kZXNcblx0ICogQHBhcmFtIHNvdXJjZU5vZGVJbmRleCAtIEluZGV4IG9mIHNvdXJjZSBub2RlLCBpZiBudWxsLCByZXR1cm4gYWxsIGxpbmtzIGdvaW5nIHRvIHRhcmdldFxuXHQgKiBAcGFyYW0gdGFyZ2V0Tm9kZUluZGV4IC0gSW5kZXggb2YgdGFyZ2V0IG5vZGUsIGlmIG51bGwsIHJldHVybiBhbGwgbGlua3Mgc3RhcnRpbmcgZnJvbSBzb3VyY2Vcblx0ICovXG5cdGxpbmtPYmplY3RzQmV0d2VlbiA6IGZ1bmN0aW9uKHNvdXJjZU5vZGVJbmRleCx0YXJnZXROb2RlSW5kZXgpIHtcblx0XHRmdW5jdGlvbiBpc1Byb3ZpZGVkKHBhcmFtKSB7XG5cdFx0XHRpZiAocGFyYW0gPT09IHVuZGVmaW5lZCB8fCBwYXJhbSA9PT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXNQcm92aWRlZChzb3VyY2VOb2RlSW5kZXgpICYmICFpc1Byb3ZpZGVkKHRhcmdldE5vZGVJbmRleCkpIHtcblx0XHRcdHZhciBhbGxTb3VyY2UgPSB0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lW3NvdXJjZU5vZGVJbmRleF07XG5cdFx0XHR2YXIganVzdFNvdXJjZSA9IGFsbFNvdXJjZS5maWx0ZXIoZnVuY3Rpb24obGluaykge1xuXHRcdFx0XHRyZXR1cm4gbGluay5zb3VyY2UuaW5kZXggPT09IHNvdXJjZU5vZGVJbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGp1c3RTb3VyY2U7XG5cdFx0fSBlbHNlIGlmICghaXNQcm92aWRlZChzb3VyY2VOb2RlSW5kZXgpICYmIGlzUHJvdmlkZWQodGFyZ2V0Tm9kZUluZGV4KSkge1xuXHRcdFx0dmFyIGFsbFRhcmdldCA9IHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmVbdGFyZ2V0Tm9kZUluZGV4XTtcblx0XHRcdHZhciBqdXN0VGFyZ2V0ID0gYWxsVGFyZ2V0LmZpbHRlcihmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHRcdHJldHVybiBsaW5rLnRhcmdldC5pbmRleCA9PT0gdGFyZ2V0Tm9kZUluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4ganVzdFRhcmdldDtcblx0XHR9IGVsc2UgaWYgKGlzUHJvdmlkZWQoc291cmNlTm9kZUluZGV4KSAmJiBpc1Byb3ZpZGVkKHRhcmdldE5vZGVJbmRleCkpIHtcblx0XHRcdHZhciBzb3VyY2VMaW5rcyA9IHRoaXMubGlua09iamVjdHNCZXR3ZWVuKHNvdXJjZU5vZGVJbmRleCxudWxsKTtcblx0XHRcdHZhciB0b1RhcmdldCA9IHNvdXJjZUxpbmtzLmZpbHRlcihmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHRcdHJldHVybiBsaW5rLnRhcmdldC5pbmRleCA9PT0gdGFyZ2V0Tm9kZUluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdG9UYXJnZXQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgY2FudmFzIGZvciB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIGNhbnZhcyAtIGFuIEhUTUwgY2FudmFzIG9iamVjdFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGNhbnZhcyBwYXJhbWV0ZXIgaXMgZGVmaW5lZCwgdGhlIGNhbnZhcyBvdGhlcndpc2Vcblx0ICovXG5cdGNhbnZhcyA6IGZ1bmN0aW9uKGNhbnZhcykge1xuXHRcdGlmIChjYW52YXMpIHtcblx0XHRcdHRoaXMuX2NhbnZhcyA9IGNhbnZhcztcblxuXHRcdFx0dmFyIHgseTtcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdCQodGhpcy5fY2FudmFzKS5vbignbW91c2Vkb3duJyxmdW5jdGlvbihlKSB7XG5cdFx0XHRcdHggPSBlLmNsaWVudFg7XG5cdFx0XHRcdHkgPSBlLmNsaWVudFk7XG5cdFx0XHRcdCQodGhhdC5fY2FudmFzKS5vbignbW91c2Vtb3ZlJyxmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0dmFyIGR4ID0geCAtIGUuY2xpZW50WDtcblx0XHRcdFx0XHR2YXIgZHkgPSB5IC0gZS5jbGllbnRZO1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9kcmFnZ2FibGUgJiYgdGhhdC5fY3VycmVudE92ZXJOb2RlICYmICh0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID09PSBudWxsIHx8IHRoYXQuX2N1cnJlbnRNb3ZlU3RhdGUgPT09ICdkcmFnZ2luZycpKSAge1xuXHRcdFx0XHRcdFx0dGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9ICdkcmFnZ2luZyc7XG5cblx0XHRcdFx0XHRcdC8vIE1vdmUgdGhlIG5vZGVcblx0XHRcdFx0XHRcdHRoYXQuX2xheW91dGVyLl9zZXROb2RlUG9zaXRpb25JbW1lZGlhdGUodGhhdC5fY3VycmVudE92ZXJOb2RlLCB0aGF0Ll9jdXJyZW50T3Zlck5vZGUueCAtIGR4LCB0aGF0Ll9jdXJyZW50T3Zlck5vZGUueSAtIGR5KTtcblx0XHRcdFx0XHRcdHRoYXQudXBkYXRlKCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0aGF0Ll9wYW5uYWJsZSAmJiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9PT0gbnVsbCB8fCB0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID09PSAncGFubmluZycpKSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9wYW4oLWR4KnRoYXQuX2ludmVydGVkUGFuLC1keSp0aGF0Ll9pbnZlcnRlZFBhbik7XG5cdFx0XHRcdFx0XHR0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID0gJ3Bhbm5pbmcnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR4ID0gZS5jbGllbnRYO1xuXHRcdFx0XHRcdHkgPSBlLmNsaWVudFk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdCQodGhpcy5fY2FudmFzKS5vbignbW91c2V1cCcsZnVuY3Rpb24oKSB7XG5cdFx0XHRcdCQodGhhdC5fY2FudmFzKS5vZmYoJ21vdXNlbW92ZScpO1xuXHRcdFx0XHRpZiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9PT0gJ2RyYWdnaW5nJykge1xuXHRcdFx0XHRcdHRoYXQuX2N1cnJlbnRPdmVyTm9kZSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9IG51bGw7XG5cdFx0XHR9KTtcblxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9jYW52YXM7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXQgd2lkdGhcblx0ICogQHJldHVybnMgV2lkdGggaW4gcGl4ZWxzIG9mIHRoZSBncmFwaFxuXHQgKi9cblx0d2lkdGggOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc2NlbmUud2lkdGg7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCBoZWlnaHRcblx0ICogQHJldHVybnMgSGVpZ2h0IGluIHBpeGVscyBvZiB0aGUgZ3JhcGhcblx0ICovXG5cdGhlaWdodCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9zY2VuZS5oZWlnaHQ7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRvZ2dsZXMgYm9vbGVhbiBmb3Igc2hvd2luZy9oaWRpbmcgYWxsIGxhYmVscyBpbiB0aGUgZ3JhcGggYnkgZGVmYXVsdFxuXHQgKiBAcGFyYW0gc2hvd0FsbExhYmVsc1xuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdHNob3dBbGxMYWJlbHMgOiBmdW5jdGlvbihzaG93QWxsTGFiZWxzKSB7XG5cdFx0aWYgKHNob3dBbGxMYWJlbHMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fc2hvd0FsbExhYmVscyA9IHNob3dBbGxMYWJlbHM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9zaG93QWxsTGFiZWxzO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZVxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdGlmIChzaG93QWxsTGFiZWxzKSB7XG5cdFx0XHRcdHRoYXQuYWRkTGFiZWwobm9kZSxub2RlLmxhYmVsVGV4dCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGF0LnJlbW92ZUxhYmVsKG5vZGUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBsYWJlbCBmb3IgYSBub2RlXG5cdCAqIEBwYXJhbSBub2RlXG5cdCAqIEBwYXJhbSB0ZXh0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGFkZExhYmVsIDogZnVuY3Rpb24obm9kZSx0ZXh0KSB7XG5cdFx0aWYgKHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZS5pbmRleF0pIHtcblx0XHRcdHRoaXMucmVtb3ZlTGFiZWwobm9kZSk7XG5cdFx0fVxuXHRcdHZhciBsYWJlbEF0dHJzID0gdGhpcy5fbGF5b3V0ZXIubGF5b3V0TGFiZWwobm9kZSk7XG5cblx0XHR2YXIgZm9udFNpemUgPSB0eXBlb2YodGhpcy5fZm9udFNpemUpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udFNpemUobm9kZSkgOiB0aGlzLl9mb250U2l6ZTtcblx0XHRpZiAoIWZvbnRTaXplKSB7XG5cdFx0XHRmb250U2l6ZSA9IDEwO1xuXHRcdH1cblxuXHRcdHZhciBmb250RmFtaWx5ID0gdHlwZW9mKHRoaXMuX2ZvbnRGYW1pbHkpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udEZhbWlseShub2RlKSA6IHRoaXMuX2ZvbnRGYW1pbHk7XG5cdFx0aWYgKCFmb250RmFtaWx5KSB7XG5cdFx0XHRmb250RmFtaWx5ID0gJ3NhbnMtc2VyaWYnO1xuXHRcdH1cblx0XHR2YXIgZm9udFN0ciA9IGZvbnRTaXplICsgJ3B4ICcgKyBmb250RmFtaWx5O1xuXG5cdFx0dmFyIGZvbnRGaWxsID0gdHlwZW9mKHRoaXMuX2ZvbnRDb2xvcikgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9mb250Q29sb3Iobm9kZSkgOiB0aGlzLl9mb250Q29sb3I7XG5cdFx0aWYgKCFmb250RmlsbCkge1xuXHRcdFx0Zm9udEZpbGwgPSAnIzAwMDAwMCc7XG5cdFx0fVxuXHRcdHZhciBmb250U3Ryb2tlID0gdHlwZW9mKHRoaXMuX2ZvbnRTdHJva2UpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udFN0cm9rZShub2RlKSA6IHRoaXMuX2ZvbnRTdHJva2U7XG5cdFx0dmFyIGZvbnRTdHJva2VXaWR0aCA9IHR5cGVvZih0aGlzLl9mb250U3Ryb2tlKSA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX2ZvbnRTdHJva2VXaWR0aCA6IHRoaXMuX2ZvbnRTdHJva2VXaWR0aDtcblxuXHRcdHZhciBsYWJlbFNwZWMgPSB7XG5cdFx0XHRmb250OiBmb250U3RyLFxuXHRcdFx0ZmlsbFN0eWxlOiBmb250RmlsbCxcblx0XHRcdHN0cm9rZVN0eWxlOiBmb250U3Ryb2tlLFxuXHRcdFx0bGluZVdpZHRoOiBmb250U3Ryb2tlV2lkdGgsXG5cdFx0XHR0ZXh0IDogdGV4dFxuXHRcdH07XG5cblx0XHR2YXIgYkFkZFNoYWRvdyA9IHRoaXMuX3NoYWRvd0JsdXIgfHwgdGhpcy5fc2hhZG93T2Zmc2V0WCB8fCB0aGlzLl9zaGFkb3dPZmZzZXRZIHx8IHRoaXMuX3NoYWRvd0NvbG9yO1xuXHRcdGlmIChiQWRkU2hhZG93KSB7XG5cdFx0XHRsYWJlbFNwZWNbJ3NoYWRvd0NvbG9yJ10gPSB0aGlzLl9zaGFkb3dDb2xvciB8fCAnIzAwMCc7XG5cdFx0XHRsYWJlbFNwZWNbJ3NoYWRvd09mZnNldFgnXSA9IHRoaXMuX3NoYWRvd09mZnNldFggfHwgMDtcblx0XHRcdGxhYmVsU3BlY1snc2hhZG93T2Zmc2V0WSddID0gdGhpcy5fc2hhZG93T2Zmc2V0WSB8fCAwO1xuXHRcdFx0bGFiZWxTcGVjWydzaGFkb3dCbHVyJ10gPSB0aGlzLl9zaGFkb3dCbHVyIHx8IE1hdGguZmxvb3IoZm9udFNpemUvMyk7XG5cdFx0fVxuXG5cdFx0Zm9yICh2YXIga2V5IGluIGxhYmVsQXR0cnMpIHtcblx0XHRcdGlmIChsYWJlbEF0dHJzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0bGFiZWxTcGVjW2tleV0gPSBsYWJlbEF0dHJzW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHZhciBsYWJlbCA9IHBhdGgudGV4dChsYWJlbFNwZWMpO1xuXHRcdHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZS5pbmRleF0gPSBsYWJlbDtcblx0XHR0aGlzLl9zY2VuZS5hZGRDaGlsZChsYWJlbCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogUmVtb3ZlcyBhIGxhYmVsIGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0cmVtb3ZlTGFiZWwgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0dmFyIHRleHRPYmplY3QgPSB0aGlzLl9ub2RlSW5kZXhUb0xhYmVsW25vZGUuaW5kZXhdO1xuXHRcdGlmICh0ZXh0T2JqZWN0KSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0ZXh0T2JqZWN0KTtcblx0XHRcdGRlbGV0ZSB0aGlzLl9ub2RlSW5kZXhUb0xhYmVsW25vZGUuaW5kZXhdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogRXZlbnQgaGFuZGxlciBmb3IgbW91c2VvdmVyIG9mIGEgbm9kZVxuXHQgKiBAcGFyYW0gY2FsbGJhY2sobm9kZSlcblx0ICogQHBhcmFtIHNlbGYgLSB0aGUgb2JqZWN0IHRvIGJlIGJvdW5kIGFzICd0aGlzJyBpbiB0aGUgY2FsbGJhY2tcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bm9kZU92ZXIgOiBmdW5jdGlvbihjYWxsYmFjayxzZWxmKSB7XG5cdFx0aWYgKCFzZWxmKSB7XG5cdFx0XHRzZWxmID0gdGhpcztcblx0XHR9XG5cdFx0dGhpcy5fbm9kZU92ZXIgPSBjYWxsYmFjay5iaW5kKHNlbGYpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBFdmVudCBoYW5kbGVyIGZvciBtb3VzZW91dCBvZiBhIG5vZGVcblx0ICogQHBhcmFtIGNhbGxiYWNrKG5vZGUpXG5cdCAqIEBwYXJhbSBzZWxmIC0gdGhlIG9iamVjdCB0byBiZSBib3VuZCBhcyAndGhpcycgaW4gdGhlIGNhbGxiYWNrXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdG5vZGVPdXQgOiBmdW5jdGlvbihjYWxsYmFjayxzZWxmKSB7XG5cdFx0aWYgKCFzZWxmKSB7XG5cdFx0XHRzZWxmID0gdGhpcztcblx0XHR9XG5cdFx0dGhpcy5fbm9kZU91dCA9IGNhbGxiYWNrLmJpbmQoc2VsZik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENvbnZlbmllbmNlIGZ1bmN0aW9uIGZvciBzZXR0aW5nIG5vZGVPdmVyL25vZGVPdXQgaW4gYSBzaW5nbGUgY2FsbFxuXHQgKiBAcGFyYW0gb3ZlciAtIHRoZSBub2RlT3ZlciBldmVudCBoYW5kbGVyXG5cdCAqIEBwYXJhbSBvdXQgLSB0aGUgbm9kZU91dCBldmVudCBoYW5kbGVyXG5cdCAqIEBwYXJhbSBzZWxmIC0gdGhlIG9iamVjdCB0byBiZSBib3VuZCBhcyAndGhpcycgaW4gdGhlIGNhbGxiYWNrXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdG5vZGVIb3ZlciA6IGZ1bmN0aW9uKG92ZXIsb3V0LHNlbGYpIHtcblx0XHRpZiAoIXNlbGYpIHtcblx0XHRcdHNlbGYgPSB0aGlzO1xuXHRcdH1cblx0XHR0aGlzLm5vZGVPdmVyKG92ZXIsc2VsZik7XG5cdFx0dGhpcy5ub2RlT3V0KG91dCxzZWxmKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogRXZlbnQgaGFuZGxlciBmb3IgY2xpY2sgb2YgYSBub2RlXG5cdCAqIEBwYXJhbSBjYWxsYmFjayhub2RlKVxuXHQgKiBAcGFyYW0gc2VsZiAtIHRoZSBvYmplY3QgdG8gYmUgYm91bmQgYXMgJ3RoaXMnLiAgIERlZmF1bHRzIHRvIHRoZSBncmFwaCBvYmplY3Rcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bm9kZUNsaWNrIDogZnVuY3Rpb24oY2FsbGJhY2ssc2VsZikge1xuXHRcdGlmICghc2VsZikge1xuXHRcdFx0c2VsZiA9IHRoaXM7XG5cdFx0fVxuXHRcdHRoaXMuX25vZGVDbGljayA9IGNhbGxiYWNrLmJpbmQoc2VsZik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFBhbiB7R3JhcGh9IGJ5IChkeCxkeSkuICAgQXV0b21hdGljYWxseSByZXJlbmRlciB0aGUgZ3JhcGguXG5cdCAqIEBwYXJhbSBkeCAtIEFtb3VudCBvZiBwYW4gaW4geCBkaXJlY3Rpb25cblx0ICogQHBhcmFtIGR5IC0gQW1vdW50IG9mIHBhbiBpbiB5IGRpcmVjdGlvblxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3BhbiA6IGZ1bmN0aW9uKGR4LGR5KSB7XG5cdFx0dGhpcy5fc2NlbmUueCArPSBkeDtcblx0XHR0aGlzLl9zY2VuZS55ICs9IGR5O1xuXHRcdHRoaXMuX3BhblggKz0gZHg7XG5cdFx0dGhpcy5fcGFuWSArPSBkeTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBNYWtlIHtHcmFwaH0gcGFubmFibGVcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0cGFubmFibGUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9wYW5uYWJsZSA9IHRydWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE1ha2VzIHRoZSBncmFwaCBwYW4gaW4gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbiBvZiB0aGUgbW91c2UgYXMgb3Bwb3NlZCB0byB3aXRoIGl0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGludmVydFBhbiA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX2ludmVydGVkUGFuID0gLTE7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE1ha2Ugbm9kZXMgaW4ge0dyYXBofSByZXBvaXNpdGlvbmFibGUgYnkgY2xpY2stZHJhZ2dpbmdcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0ZHJhZ2dhYmxlIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5fZHJhZ2dhYmxlID0gdHJ1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRfZ2V0Wm9vbUZvckxldmVsIDogZnVuY3Rpb24obGV2ZWwpIHtcblx0XHR2YXIgZmFjdG9yID0gTWF0aC5wb3coMS41ICwgTWF0aC5hYnMobGV2ZWwgLSB0aGlzLl96b29tTGV2ZWwpKTtcblx0XHRpZiAobGV2ZWwgPCB0aGlzLl96b29tTGV2ZWwpIHtcblx0XHRcdGZhY3RvciA9IDEvZmFjdG9yO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFjdG9yO1xuXHR9LFxuXG5cdF96b29tIDogZnVuY3Rpb24oZmFjdG9yLHgseSkge1xuXHRcdHRoaXMuX3pvb21TY2FsZSAqPSBmYWN0b3I7XG5cdFx0dGhpcy5fbGF5b3V0ZXIuX3pvb21TY2FsZSA9IHRoaXMuX3pvb21TY2FsZTtcblxuXHRcdC8vIFBhbiBzY2VuZSBiYWNrIHRvIG9yaWdpblxuXHRcdHZhciBvcmlnaW5hbFggPSB0aGlzLl9zY2VuZS54O1xuXHRcdHZhciBvcmlnaW5hbFkgPSB0aGlzLl9zY2VuZS55O1xuXHRcdHRoaXMuX3BhbigtdGhpcy5fc2NlbmUueCwtdGhpcy5fc2NlbmUueSk7XG5cblx0XHR2YXIgbW91c2VYID0geCB8fCAwO1xuXHRcdHZhciBtb3VzZVkgPSB5IHx8IDA7XG5cblx0XHQvLyAnWm9vbScgbm9kZXMuICAgV2UgZG8gdGhpcyBzbyB0ZXh0L3JhZGl1cyBzaXplIHJlbWFpbnMgY29uc2lzdGVudCBhY3Jvc3Mgem9vbSBsZXZlbHNcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX25vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR0aGlzLl9sYXlvdXRlci5fc2V0Tm9kZVBvc2l0aW9uKHRoaXMuX25vZGVzW2ldLHRoaXMuX25vZGVzW2ldLngqZmFjdG9yLCB0aGlzLl9ub2Rlc1tpXS55KmZhY3Rvcix0cnVlKTtcblx0XHR9XG5cblx0XHQvLyBab29tIHRoZSByZW5kZXIgZ3JvdXBzXG5cdFx0dGhpcy5fYWRkUHJlQW5kUG9zdFJlbmRlck9iamVjdHMoKTtcblxuXG5cdFx0Ly8gUmV2ZXJzZSB0aGUgJ29yaWdpbiBwYW4nIHdpdGggdGhlIHNjYWxlIGFwcGxpZWQgYW5kIHJlY2VudGVyIHRoZSBtb3VzZSB3aXRoIHNjYWxlIGFwcGxpZWQgYXMgd2VsbFxuXHRcdHZhciBuZXdNb3VzZVggPSBtb3VzZVgqZmFjdG9yO1xuXHRcdHZhciBuZXdNb3VzZVkgPSBtb3VzZVkqZmFjdG9yO1xuXHRcdHRoaXMuX3BhbihvcmlnaW5hbFgqZmFjdG9yIC0gKG5ld01vdXNlWC1tb3VzZVgpLG9yaWdpbmFsWSpmYWN0b3IgLSAobmV3TW91c2VZLW1vdXNlWSkpO1xuXG5cblx0XHQvLyBVcGRhdGUgdGhlIHJlZ3JvdXAgdW5kZXJsYXlzXG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGlmICh0aGlzLl9oYW5kbGVHcm91cCAmJiB0aGlzLl9oYW5kbGVHcm91cC5jaGlsZHJlbiAmJiB0aGlzLl9oYW5kbGVHcm91cC5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2hhbmRsZUdyb3VwLnJlbW92ZUFsbCgpO1xuXHRcdFx0dGhhdC5fc2NlbmUudXBkYXRlKCk7XG5cdFx0XHR0aGF0Ll9hZGRSZWdyb3VwSGFuZGxlcygpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogTWFrZSB7R3JhcGh9IHpvb21hYmxlIGJ5IHVzaW5nIHRoZSBtb3VzZXdoZWVsXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdHpvb21hYmxlIDogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF0aGlzLl96b29tYWJsZSkge1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCh0aGlzLl9jYW52YXMpLm9uKCdtb3VzZXdoZWVsJyxmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciB3aGVlbCA9IGUub3JpZ2luYWxFdmVudC53aGVlbERlbHRhLzEyMDsvL24gb3IgLW5cblx0XHRcdFx0dmFyIGZhY3Rvcjtcblx0XHRcdFx0aWYgKHdoZWVsIDwgMCkge1xuXHRcdFx0XHRcdGZhY3RvciA9IHRoYXQuX2dldFpvb21Gb3JMZXZlbCh0aGF0Ll96b29tTGV2ZWwtMSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZmFjdG9yID0gdGhhdC5fZ2V0Wm9vbUZvckxldmVsKHRoYXQuX3pvb21MZXZlbCsxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGF0Ll96b29tKGZhY3RvciwgZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3pvb21hYmxlID0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGxheW91dCBmdW5jdGlvbiBmb3IgdGhlIG5vZGVzXG5cdCAqIEBwYXJhbSBsYXlvdXRlciAtIEFuIGluc3RhbmNlIChvciBzdWJjbGFzcykgb2YgTGF5b3V0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaXMgbGF5b3V0ZXIgcGFyYW0gaXMgZGVmaW5lZCwgdGhlIGxheW91dGVyIG90aGVyd2lzZVxuXHQgKi9cblx0bGF5b3V0ZXIgOiBmdW5jdGlvbihsYXlvdXRlcikge1xuXHRcdGlmIChsYXlvdXRlcikge1xuXHRcdFx0dGhpcy5fbGF5b3V0ZXIgPSBsYXlvdXRlcjtcblx0XHRcdHRoaXMuX2xheW91dGVyXG5cdFx0XHRcdC5ub2Rlcyh0aGlzLl9ub2Rlcylcblx0XHRcdFx0LmxpbmtNYXAodGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSlcblx0XHRcdFx0Lm5vZGVNYXAodGhpcy5fbm9kZUluZGV4VG9DaXJjbGUpXG5cdFx0XHRcdC5sYWJlbE1hcCh0aGlzLl9ub2RlSW5kZXhUb0xhYmVsKVxuXHRcdFx0XHQuc2NlbmUodGhpcy5fc2NlbmUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0ZXI7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBQZXJmb3JtcyBhIGxheW91dCBvZiB0aGUgZ3JhcGhcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bGF5b3V0IDogZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRpZiAodGhpcy5fbGF5b3V0ZXIpIHtcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuX2xheW91dGVyLmxheW91dCh0aGlzLl9jYW52YXMud2lkdGgsdGhpcy5fY2FudmFzLmhlaWdodCxjYWxsYmFjayk7XG5cblxuXHRcdFx0Ly8gVXBkYXRlIHRoZSByZWdyb3VwIHVuZGVybGF5c1xuXHRcdFx0aWYgKHRoaXMuX2hhbmRsZUdyb3VwICYmIHRoaXMuX2hhbmRsZUdyb3VwLmNoaWxkcmVuKSB7XG5cdFx0XHRcdHZhciB1bmRlcmxheXMgPSB0aGlzLl9oYW5kbGVHcm91cC5jaGlsZHJlbjtcblx0XHRcdFx0dW5kZXJsYXlzLmZvckVhY2goZnVuY3Rpb24oaGFuZGxlT2JqZWN0KSB7XG5cdFx0XHRcdFx0dmFyIGluZGljZXMgPSBoYW5kbGVPYmplY3QuZ3JhcGhqc19pbmRpY2VzO1xuXHRcdFx0XHRcdHZhciBiYiA9IHRoYXQuX2xheW91dGVyLmdldEJvdW5kaW5nQm94KGluZGljZXMsIFJFR1JPVU5EX0JCX1BBRERJTkcpO1xuXHRcdFx0XHRcdGlmIChoYW5kbGVPYmplY3QuZ3JhcGhqc190eXBlID09PSAncmVncm91cF91bmRlcmxheScpIHtcblx0XHRcdFx0XHRcdGhhbmRsZU9iamVjdC50d2VlbkF0dHIoe1xuXHRcdFx0XHRcdFx0XHR4OiBiYi54LFxuXHRcdFx0XHRcdFx0XHR5OiBiYi55LFxuXHRcdFx0XHRcdFx0XHR3aWR0aDogYmIud2lkdGgsXG5cdFx0XHRcdFx0XHRcdGhlaWdodDogYmIuaGVpZ2h0XG5cdFx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRcdGR1cmF0aW9uOiB0aGF0Ll9sYXlvdXRlci5kdXJhdGlvbigpLFxuXHRcdFx0XHRcdFx0XHRlYXNpbmc6IHRoYXQuX2xheW91dGVyLmVhc2luZygpXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGhhbmRsZU9iamVjdC5ncmFwaGpzX3R5cGUgPT09ICdyZWdyb3VwX2ljb24nKSB7XG5cdFx0XHRcdFx0XHR2YXIgdW5ncm91cGVkTm9kZXMgPSB0aGF0Ll9ncm91cGluZ01hbmFnZXIuZ2V0VW5ncm91cGVkTm9kZXNGb3JLZXkoaGFuZGxlT2JqZWN0LmdyYXBoanNfZ3JvdXBfa2V5KTtcblx0XHRcdFx0XHRcdHZhciBpY29uUG9zaXRpb24gPSB0aGF0Ll9ncm91cGluZ01hbmFnZXIuZ2V0TWluaW1pemVJY29uUG9zaXRpb24oYmIsdW5ncm91cGVkTm9kZXMpO1xuXHRcdFx0XHRcdFx0aGFuZGxlT2JqZWN0LnR3ZWVuQXR0cih7XG5cdFx0XHRcdFx0XHRcdHg6IGljb25Qb3NpdGlvbi54LFxuXHRcdFx0XHRcdFx0XHR5OiBpY29uUG9zaXRpb24ueVxuXHRcdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0XHRkdXJhdGlvbjogdGhhdC5fbGF5b3V0ZXIuZHVyYXRpb24oKSxcblx0XHRcdFx0XHRcdFx0ZWFzaW5nOiB0aGF0Ll9sYXlvdXRlci5lYXNpbmcoKVxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBncm91cGluZyBtYW5hZ2VyLlxuXHQgKiBAcGFyYW0gZ3JvdXBpbmdNYW5hZ2VyXG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0Z3JvdXBpbmdNYW5hZ2VyIDogZnVuY3Rpb24oZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0aWYgKGdyb3VwaW5nTWFuYWdlcikge1xuXHRcdFx0dGhpcy5fZ3JvdXBpbmdNYW5hZ2VyID0gZ3JvdXBpbmdNYW5hZ2VyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZ3JvdXBpbmdNYW5hZ2VyO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZXMgdGhlIGdyb3VwaW5nIG1hbmFnZXIgcHJvdmlkZWQgYW5kIGNhbGxzIHRoZSBtZXRob2RzIGZvciBhZ2dyZWdhdGluZyBub2RlcyBhbmQgbGlua3Ncblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0aW5pdGlhbGl6ZUdyb3VwaW5nIDogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMuX2dyb3VwaW5nTWFuYWdlcikge1xuXG5cdFx0XHR0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdFx0bm9kZS5wYXJlbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLm5vZGVzKHRoaXMuX25vZGVzKVxuXHRcdFx0XHQubGlua3ModGhpcy5fbGlua3MpXG5cdFx0XHRcdC5pbml0aWFsaXplSGVpcmFyY2h5KCk7XG5cblx0XHRcdHRoaXMubm9kZXModGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmFnZ3JlZ2F0ZWROb2RlcygpKTtcblx0XHRcdHRoaXMubGlua3ModGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmFnZ3JlZ2F0ZWRMaW5rcygpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVuZ3JvdXBzIHRoZSBwcm9kaWRlZCBhZ2dyZWdhdGUgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZSAtIHRoZSBhZ2dyZWdhdGUgbm9kZSB0byBiZSB1bmdyb3VwZWRcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0dW5ncm91cCA6IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRpZiAoIW5vZGUgfHwgIW5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0aWYgKHRoaXMuX2dyb3VwaW5nTWFuYWdlcikge1xuXHRcdFx0dGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLnVuZ3JvdXAobm9kZSk7XG5cdFx0XHR0aGlzLmNsZWFyKClcblx0XHRcdFx0Lm5vZGVzKHRoaXMuX2dyb3VwaW5nTWFuYWdlci5hZ2dyZWdhdGVkTm9kZXMoKSlcblx0XHRcdFx0LmxpbmtzKHRoaXMuX2dyb3VwaW5nTWFuYWdlci5hZ2dyZWdhdGVkTGlua3MoKSlcblx0XHRcdFx0LmRyYXcoKTtcblxuXHRcdFx0dGhpcy5fbGF5b3V0ZXIuX2FwcGx5Wm9vbVNjYWxlKHRydWUpO1xuXHRcdFx0dGhpcy5sYXlvdXQoKTtcblx0XHRcdHRoaXMuX2xheW91dGVyLl9hcHBseVpvb21TY2FsZShmYWxzZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZWdyb3VwcyB0aGUgYWdncmVnYXRlIG5vZGUuICAgQ2FuIGJlIGNhbGxlZCBwcm9ncmFtYXR0aWNhbGx5IGJ1dCBpcyBhdXRvbWF0aWNhbGx5IGludm9rZWQgd2hlbiBjbGlja2luZyBvbiB0aGVcblx0ICogcmVncm91cCBoYW5kbGVyXG5cdCAqIEBwYXJhbSB1bmdyb3VwZWRBZ2dyZWdhdGVLZXlcblx0ICovXG5cdHJlZ3JvdXAgOiBmdW5jdGlvbih1bmdyb3VwZWRBZ2dyZWdhdGVLZXkpIHtcblx0XHQvLyBBbmltYXRlIHRoZSByZWdyb3VwXG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdHZhciBwYXJlbnRBZ2dyZWdhdGUgPSB0aGlzLl9ncm91cGluZ01hbmFnZXIuZ2V0QWdncmVnYXRlKHVuZ3JvdXBlZEFnZ3JlZ2F0ZUtleSk7XG5cblx0XHR2YXIgYXZnUG9zID0geyB4OiAwLCB5IDogMH07XG5cdFx0dmFyIG1heFJhZGl1cyA9IDA7XG5cdFx0cGFyZW50QWdncmVnYXRlLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcblx0XHRcdGF2Z1Bvcy54ICs9IGNoaWxkLng7XG5cdFx0XHRhdmdQb3MueSArPSBjaGlsZC55O1xuXHRcdH0pO1xuXHRcdGF2Z1Bvcy54IC89IHBhcmVudEFnZ3JlZ2F0ZS5jaGlsZHJlbi5sZW5ndGg7XG5cdFx0YXZnUG9zLnkgLz0gcGFyZW50QWdncmVnYXRlLmNoaWxkcmVuLmxlbmd0aDtcblxuXHRcdHZhciBpbmRleE9mQ2hpbGRyZW4gPSBwYXJlbnRBZ2dyZWdhdGUuY2hpbGRyZW4ubWFwKGZ1bmN0aW9uKGNoaWxkKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoYXQuX2dyb3VwaW5nTWFuYWdlci5fYWdncmVnYXRlZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICh0aGF0Ll9ncm91cGluZ01hbmFnZXIuX2FnZ3JlZ2F0ZWROb2Rlc1tpXS5pbmRleCA9PT0gY2hpbGQuaW5kZXgpIHtcblx0XHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHZhciBtaW5DaGlsZEluZGV4ID0gTnVtYmVyLk1BWF9WQUxVRTtcblx0XHRpbmRleE9mQ2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihpZHgpIHtcblx0XHRcdG1pbkNoaWxkSW5kZXggPSBNYXRoLm1pbihtaW5DaGlsZEluZGV4LGlkeCk7XG5cdFx0fSk7XG5cblx0XHR2YXIgYW5pbWF0ZWRSZWdyb3VwZWQgPSAwO1xuXHRcdHRoaXMuX3N1c3BlbmRFdmVudHMoKTtcdFx0XHQvLyBsYXlvdXQgd2lsbCByZXN1bWUgdGhlbVxuXHRcdHBhcmVudEFnZ3JlZ2F0ZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG5cblx0XHRcdC8vVE9ETzogICBXaGVuIHdlIGNhbiBzdXBwb3J0IHRyYW5zcGFyZW50IHRleHQgaW4gcGF0aCwgZmFkZSBvdXQgdGhlIGxhYmVsIGFzIHdlIG1vdmUgaXQgdG9nZXRoZXIgaWYgaXQncyBzaG93aW5nXG5cdFx0XHR0aGF0LnJlbW92ZUxhYmVsKGNoaWxkKTtcblx0XHRcdHRoYXQuX2xheW91dGVyLl9zZXROb2RlUG9zaXRpb24oY2hpbGQsYXZnUG9zLngsYXZnUG9zLnksZmFsc2UsZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGFuaW1hdGVkUmVncm91cGVkKys7XG5cdFx0XHRcdGlmIChhbmltYXRlZFJlZ3JvdXBlZCA9PT0gcGFyZW50QWdncmVnYXRlLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9ncm91cGluZ01hbmFnZXIpIHtcblx0XHRcdFx0XHRcdHZhciByZWdyb3VwZWRBZ2dyZWdhdGUgPSB0aGF0Ll9ncm91cGluZ01hbmFnZXIucmVncm91cCh1bmdyb3VwZWRBZ2dyZWdhdGVLZXksbWluQ2hpbGRJbmRleCk7XG5cdFx0XHRcdFx0XHRyZWdyb3VwZWRBZ2dyZWdhdGUueCA9IGF2Z1Bvcy54O1xuXHRcdFx0XHRcdFx0cmVncm91cGVkQWdncmVnYXRlLnkgPSBhdmdQb3MueTtcblx0XHRcdFx0XHRcdHRoYXQuY2xlYXIoKVxuXHRcdFx0XHRcdFx0XHQubm9kZXModGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLmFnZ3JlZ2F0ZWROb2RlcygpKVxuXHRcdFx0XHRcdFx0XHQubGlua3ModGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLmFnZ3JlZ2F0ZWRMaW5rcygpKTtcblx0XHRcdFx0XHRcdHRoYXQuZHJhdygpO1xuXHRcdFx0XHRcdFx0dGhhdC5fbGF5b3V0ZXIuX2FwcGx5Wm9vbVNjYWxlKHRydWUpO1xuXHRcdFx0XHRcdFx0dGhhdC5sYXlvdXQoKTtcblx0XHRcdFx0XHRcdHRoYXQuX2xheW91dGVyLl9hcHBseVpvb21TY2FsZShmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvbnQgc2l6ZSBmb3IgbGFiZWxzXG5cdCAqIEBwYXJhbSBmb250U2l6ZSAtIHNpemUgb2YgdGhlIGZvbnQgaW4gcGl4ZWxzXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgZm9udFNpemUgcGFyYW0gaXMgZGVpZm5lZCwge0dyYXBoLl9mb250U2l6ZX0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRmb250U2l6ZSA6IGZ1bmN0aW9uKGZvbnRTaXplKSB7XG5cdFx0aWYgKGZvbnRTaXplKSB7XG5cdFx0XHR0aGlzLl9mb250U2l6ZSA9IGZvbnRTaXplO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZm9udFNpemU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvbnQgY29sb3VyIGZvciBsYWJlbHNcblx0ICogQHBhcmFtIGZvbnRDb2xvdXIgLSBBIGhleCBzdHJpbmcgZm9yIHRoZSBjb2xvdXIgb2YgdGhlIGxhYmVsc1xuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGZvbnRDb2xvdXIgcGFyYW0gaXMgZGVpZm5lZCwge0dyYXBoLl9mb250Q29sb3VyfSBvdGhlcndpc2Vcblx0ICovXG5cdGZvbnRDb2xvdXIgOiBmdW5jdGlvbihmb250Q29sb3VyKSB7XG5cdFx0aWYgKGZvbnRDb2xvdXIpIHtcblx0XHRcdHRoaXMuX2ZvbnRDb2xvciA9IGZvbnRDb2xvdXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb250Q29sb3I7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvbnQgc3Ryb2tlIGZvciBsYWJlbHNcblx0ICogQHBhcmFtIGZvbnRTdHJva2UgLSBBIGhleCBzdHJpbmcgZm9yIHRoZSBjb2xvciBvZiB0aGUgbGFiZWwgc3Ryb2tlXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgZm9udFN0cm9rZSBwYXJhbSBpcyBkZWZpbmVkLCB7R3JhcGguX2ZvbnRTdHJva2V9IG90aGVyd2lzZVxuXHQgKi9cblx0Zm9udFN0cm9rZSA6IGZ1bmN0aW9uKGZvbnRTdHJva2UpIHtcblx0XHRpZiAoZm9udFN0cm9rZSkge1xuXHRcdFx0dGhpcy5fZm9udFN0cm9rZSA9IGZvbnRTdHJva2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb250U3Ryb2tlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBmb250IHN0cm9rZSB3aWR0aCBmb3IgbGFiZWxzXG5cdCAqIEBwYXJhbSBmb250U3Ryb2tlV2lkdGggLSBzaXplIGluIHBpeGVsc1xuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGZvbnRTdHJva2VXaWR0aCBwYXJhbSBpcyBkZWZpbmVkLCB7R3JhcGguX2ZvbnRTdHJva2VXaWR0aH0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRmb250U3Ryb2tlV2lkdGggOiBmdW5jdGlvbihmb250U3Ryb2tlV2lkdGgpIHtcblx0XHRpZiAoZm9udFN0cm9rZVdpZHRoKSB7XG5cdFx0XHR0aGlzLl9mb250U3Ryb2tlV2lkdGggPSBmb250U3Ryb2tlV2lkdGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb250U3Ryb2tlV2lkdGg7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvbnQgZmFtaWx5IGZvciBsYWJlbHNcblx0ICogQHBhcmFtIGZvbnRGYW1pbHkgLSBBIHN0cmluZyBmb3IgdGhlIGZvbnQgZmFtaWx5IChhIGxhIEhUTUw1IENhbnZhcylcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBmb250RmFtaWx5IHBhcmFtIGlzIGRlaWZuZWQsIHtHcmFwaC5fZm9udEZhbWlseX0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRmb250RmFtaWx5IDogZnVuY3Rpb24oZm9udEZhbWlseSkge1xuXHRcdGlmIChmb250RmFtaWx5KSB7XG5cdFx0XHR0aGlzLl9mb250RmFtaWx5ID0gZm9udEZhbWlseTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZvbnRGYW1pbHk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvbnQgc2hhZG93IHByb3BlcnRpZXMgZm9yIGxhYmVsc1xuXHQgKiBAcGFyYW0gY29sb3IgLSB0aGUgY29sb3VyIG9mIHRoZSBzaGFkb3dcblx0ICogQHBhcmFtIG9mZnNldFggLSB0aGUgeCBvZmZzZXQgb2YgdGhlIHNoYWRvdyBmcm9tIGNlbnRlclxuXHQgKiBAcGFyYW0gb2Zmc2V0WSAtIHRoZSB5IG9mZnNldCBvZiB0aGUgc2hhZG93IGZyb20gY2VudGVyXG5cdCAqIEBwYXJhbSBibHVyIC0gdGhlIGFtb3VudCBvZiBibHVyIGFwcGxpZWQgdG8gdGhlIHNoYWRvdyBpbiBwaXhlbHNcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRmb250U2hhZG93IDogZnVuY3Rpb24oY29sb3Isb2Zmc2V0WCxvZmZzZXRZLGJsdXIpIHtcblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29sb3I6IHRoaXMuX3NoYWRvd0NvbG9yLFxuXHRcdFx0XHRvZmZzZXRYOiB0aGlzLl9zaGFkb3dPZmZzZXRYLFxuXHRcdFx0XHRvZmZzZXRZOiB0aGlzLl9zaGFkb3dPZmZzZXRZLFxuXHRcdFx0XHRibHVyOiB0aGlzLl9zaGFkb3dCbHVyXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zaGFkb3dDb2xvciA9IGNvbG9yO1xuXHRcdFx0dGhpcy5fc2hhZG93T2Zmc2V0WCA9IG9mZnNldFg7XG5cdFx0XHR0aGlzLl9zaGFkb3dPZmZzZXRZID0gb2Zmc2V0WTtcblx0XHRcdHRoaXMuX3NoYWRvd0JsdXIgPSBibHVyO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXNpemUgdGhlIGdyYXBoLiAgQXV0b21hdGljYWxseSBwZXJmb3JtcyBsYXlvdXQgYW5kIHJlcmVuZGVycyB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIHcgLSB0aGUgbmV3IHdpZHRoXG5cdCAqIEBwYXJhbSBoIC0gdGhlIG5ldyBoZWlnaHRcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0cmVzaXplIDogZnVuY3Rpb24odyxoKSB7XG5cdFx0dGhpcy5fd2lkdGggPSB3O1xuXHRcdHRoaXMuX2hlaWdodCA9IGg7XG5cdFx0JCh0aGlzLl9jYW52YXMpLmF0dHIoe3dpZHRoOncsaGVpZ2h0Omh9KVxuXHRcdFx0LndpZHRoKHcpXG5cdFx0XHQuaGVpZ2h0KGgpO1xuXHRcdHRoaXMuX3NjZW5lLnJlc2l6ZSh3LGgpO1xuXG5cdFx0aWYgKCF0aGlzLl9wYW5uYWJsZSAmJiAhdGhpcy5fem9vbWFibGUpIHtcblx0XHRcdHRoaXMubGF5b3V0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cyBhIGxpc3Qgb2YgcHJlL3Bvc3QgcmVuZGVyIG9iamVjdHMgZnJvbSB0aGUgbGF5b3V0ZXIgKGlmIGFueSlcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9hZGRQcmVBbmRQb3N0UmVuZGVyT2JqZWN0cyA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX3ByZXJlbmRlckdyb3VwLnJlbW92ZUFsbCgpO1xuXG5cdFx0Ly8gR2V0IHRoZSBiYWNrZ3JvdW5kIG9iamVjdHMgZnJvbSB0aGUgbGF5b3V0ZXJcblx0XHR2YXIgb2JqcyA9IHRoaXMuX2xheW91dGVyLnByZXJlbmRlcih0aGlzLl93aWR0aCx0aGlzLl9oZWlnaHQpO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRpZiAob2Jqcykge1xuXHRcdFx0b2Jqcy5mb3JFYWNoKGZ1bmN0aW9uKHJlbmRlck9iamVjdCkge1xuXHRcdFx0XHR0aGF0Ll9wcmVyZW5kZXJHcm91cC5hZGRDaGlsZChyZW5kZXJPYmplY3QpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcG9zdHJlbmRlckdyb3VwLnJlbW92ZUFsbCgpO1xuXHRcdG9ianMgPSB0aGlzLl9sYXlvdXRlci5wb3N0cmVuZGVyKHRoaXMuX3dpZHRoLHRoaXMuX2hlaWdodCk7XG5cdFx0aWYgKG9ianMpIHtcblx0XHRcdG9ianMuZm9yRWFjaChmdW5jdGlvbihyZW5kZXJPYmplY3QpIHtcblx0XHRcdFx0dGhhdC5fcG9zdHJlbmRlckdyb3VwLmFkZENoaWxkKHJlbmRlck9iamVjdCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgY2xpY2thYmxlIGJveGVzIHRvIHJlZ3JvdXAgYW55IHVuZ3JvdXBlZCBhZ2dyZWdhdGVzXG5cdCAqIFRPRE86ICBtYWtlIHRoaXMgbG9vayBiZXR0ZXIhXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfYWRkUmVncm91cEhhbmRsZXMgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0aWYgKHRoaXMuX2dyb3VwaW5nTWFuYWdlcikge1xuXHRcdFx0dmFyIHVuZ3JvdXBlZE5vZGVzSW5mbyA9IHRoaXMuX2dyb3VwaW5nTWFuYWdlci5nZXRVbmdyb3VwZWROb2RlcygpO1xuXHRcdFx0dW5ncm91cGVkTm9kZXNJbmZvLmZvckVhY2goZnVuY3Rpb24odW5ncm91cGVkTm9kZUluZm8pIHtcblx0XHRcdFx0dmFyIGluZGljZXMgPSB1bmdyb3VwZWROb2RlSW5mby5pbmRpY2VzO1xuXHRcdFx0XHR2YXIga2V5ID0gdW5ncm91cGVkTm9kZUluZm8ua2V5O1xuXHRcdFx0XHR2YXIgYmJveCA9IHRoYXQuX2xheW91dGVyLmdldEJvdW5kaW5nQm94KGluZGljZXMsUkVHUk9VTkRfQkJfUEFERElORyk7XG5cdFx0XHRcdHZhciBpY29uUG9zaXRpb24gPSB0aGF0Ll9ncm91cGluZ01hbmFnZXIuZ2V0TWluaW1pemVJY29uUG9zaXRpb24oYmJveCx0aGF0Ll9ncm91cGluZ01hbmFnZXIuZ2V0VW5ncm91cGVkTm9kZXNGb3JLZXkoa2V5KSk7XG5cdFx0XHRcdHZhciBtaW5pbWl6ZVJlbmRlck9iamVjdCA9IHBhdGguaW1hZ2Uoe1xuXHRcdFx0XHRcdHNyYyA6ICdkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUJRQUFBQVVDQVlBQUFDTmlSME5BQUFBQVhOU1IwSUFyczRjNlFBQUFBbHdTRmx6QUFFUWhBQUJFSVFCUDBWRllBQUFBY3RwVkZoMFdFMU1PbU52YlM1aFpHOWlaUzU0YlhBQUFBQUFBRHg0T25odGNHMWxkR0VnZUcxc2JuTTZlRDBpWVdSdlltVTZibk02YldWMFlTOGlJSGc2ZUcxd2RHczlJbGhOVUNCRGIzSmxJRFV1TkM0d0lqNEtJQ0FnUEhKa1pqcFNSRVlnZUcxc2JuTTZjbVJtUFNKb2RIUndPaTh2ZDNkM0xuY3pMbTl5Wnk4eE9UazVMekF5THpJeUxYSmtaaTF6ZVc1MFlYZ3Ribk1qSWo0S0lDQWdJQ0FnUEhKa1pqcEVaWE5qY21sd2RHbHZiaUJ5WkdZNllXSnZkWFE5SWlJS0lDQWdJQ0FnSUNBZ0lDQWdlRzFzYm5NNmVHMXdQU0pvZEhSd09pOHZibk11WVdSdlltVXVZMjl0TDNoaGNDOHhMakF2SWdvZ0lDQWdJQ0FnSUNBZ0lDQjRiV3h1Y3pwMGFXWm1QU0pvZEhSd09pOHZibk11WVdSdlltVXVZMjl0TDNScFptWXZNUzR3THlJK0NpQWdJQ0FnSUNBZ0lEeDRiWEE2UTNKbFlYUnZjbFJ2YjJ3K2QzZDNMbWx1YTNOallYQmxMbTl5Wnp3dmVHMXdPa055WldGMGIzSlViMjlzUGdvZ0lDQWdJQ0FnSUNBOGRHbG1aanBQY21sbGJuUmhkR2x2Ymo0eFBDOTBhV1ptT2s5eWFXVnVkR0YwYVc5dVBnb2dJQ0FnSUNBOEwzSmtaanBFWlhOamNtbHdkR2x2Ymo0S0lDQWdQQzl5WkdZNlVrUkdQZ284TDNnNmVHMXdiV1YwWVQ0S0dNdFZXQUFBQWNoSlJFRlVPQkdWbFQxT3cwQVFScjIyUTVSSUVRVkNSRXBEcm9DVkdvNUFRMDlMelFFaURzQVJLRGdCVndnZFVxS2NnSVltRXFKQ2x2aE5iTjVuZVlPOXNVMFlhVmp2N0xkdlpwejFZanhzTkJvZHIxYXJLMlBNRWRNZW5pcStoUmswY1pxbTh5QUl4dFBwOU40SVJtRGkrNzRIVkl3bW1BQ3lvc1lBODVJazhTam9KT2ozKzdjRURvRzlJUXd6ZWYwZkN5d3BLT2dkUmd2RzBGZWJlV1dka3FwK1Vxek9xanBpaU9VVHFYdG5sZFZZUXNXb1JEMEJxekpLWHhmWFdwMmxBdjdIL2t4U0JOb1czYkdZMEYyejg3V21DTFRaM1hFdDVzRmQwN3dFTFFLTEcvL3piSk5rZTZyT1hlSm1iYUFMVmlxcUNNd1crV0tDQnNER2tyNFFiRjJFQmFZY1NwOFQvNHBmSW5wR3RFTXNZYzVnU20wUlUxVmZKRDlndkdaOWwxZ0d0Y0NFb0lDUHM5bnNCdEhXRmtYUkJYdWpIQmlVK29mUzNwcjBLeXp0TVdSUU95cFg4Q1YraDcvZ0xiZFZZcGxSalk3S043NlBuK0l0UEdPbzVSalg5NnhBeUsxeEJzaGpFOU42czVyOFlyRUZ4U0ViNTJFWTZvTDlaSHViTWJzVTYxRWJLem9WSHhUU1hTNlhjNStIc1g1NlJsMWZhbHRWcXdWM1ZNeDFhY1RvNW94eHNGZ3NuZ2FEd1lUQ2hyU3hoMEF2dWJsZkJMbnBYY2JBSGpoQzUvb1g4QVBzQ2F2OXRINlhYUUFBQUFCSlJVNUVya0pnZ2c9PScsXG5cdFx0XHRcdFx0eCA6IGljb25Qb3NpdGlvbi54LFxuXHRcdFx0XHRcdHkgOiBpY29uUG9zaXRpb24ueSxcblx0XHRcdFx0XHRncmFwaGpzX3R5cGUgOiAncmVncm91cF9pY29uJyxcblx0XHRcdFx0XHRncmFwaGpzX2luZGljZXMgOiBpbmRpY2VzLFxuXHRcdFx0XHRcdGdyYXBoanNfZ3JvdXBfa2V5IDoga2V5LFxuXHRcdFx0XHRcdG9wYWNpdHkgOiAwLjhcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dmFyIGJvdW5kaW5nQm94UmVuZGVyT2JqZWN0ID0gcGF0aC5yZWN0KHtcblx0XHRcdFx0XHR4IDogYmJveC54LFxuXHRcdFx0XHRcdHkgOiBiYm94LnksXG5cdFx0XHRcdFx0Z3JhcGhqc190eXBlIDogJ3JlZ3JvdXBfdW5kZXJsYXknLFxuXHRcdFx0XHRcdGdyYXBoanNfaW5kaWNlcyA6IGluZGljZXMsXG5cdFx0XHRcdFx0d2lkdGggOiBiYm94LndpZHRoLFxuXHRcdFx0XHRcdGhlaWdodCA6IGJib3guaGVpZ2h0LFxuXHRcdFx0XHRcdHN0cm9rZVN0eWxlIDogJyMyMzIzMjMnLFxuXHRcdFx0XHRcdGZpbGxTdHlsZSA6ICcjMDAwMDAwJyxcblx0XHRcdFx0XHRvcGFjaXR5IDogMC4xXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRtaW5pbWl6ZVJlbmRlck9iamVjdC5vbignY2xpY2snLGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQucmVncm91cChrZXkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhhdC5faGFuZGxlR3JvdXAuYWRkQ2hpbGQobWluaW1pemVSZW5kZXJPYmplY3QpO1xuXHRcdFx0XHR0aGF0Ll9oYW5kbGVHcm91cC5hZGRDaGlsZChib3VuZGluZ0JveFJlbmRlck9iamVjdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogUmVkcmF3IHRoZSBncmFwaFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHR1cGRhdGUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9sYXlvdXRlci5wb3N0cmVuZGVyVXBkYXRlKCk7XG5cdFx0dGhpcy5fc2NlbmUudXBkYXRlKCk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIERyYXcgdGhlIGdyYXBoLiAgIE9ubHkgbmVlZHMgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBub2Rlcy9saW5rcyBoYXZlIGJlZW4gc2V0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGRyYXcgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRpZiAoIXRoaXMuX3NjZW5lKSB7XG5cdFx0XHR0aGlzLl9zY2VuZSA9IHBhdGgodGhpcy5fY2FudmFzKTtcblx0XHRcdGlmICh0aGlzLl9sYXlvdXRlcikge1xuXHRcdFx0XHR0aGlzLl9sYXlvdXRlci5zY2VuZSh0aGlzLl9zY2VuZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fbGF5b3V0ZXIpIHtcblx0XHRcdHZhciBkZWZhdWxMYXlvdXQgPSBuZXcgTGF5b3V0KClcblx0XHRcdFx0Lm5vZGVzKHRoaXMuX25vZGVzKVxuXHRcdFx0XHQubm9kZU1hcCh0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZSlcblx0XHRcdFx0LmxpbmtNYXAodGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSlcblx0XHRcdFx0LmxhYmVsTWFwKHRoaXMuX25vZGVJbmRleFRvTGFiZWwpXG5cdFx0XHRcdC5zY2VuZSh0aGlzLl9zY2VuZSk7XG5cdFx0XHR0aGlzLmxheW91dGVyKGRlZmF1bExheW91dCk7XG5cdFx0fVxuXHRcdHRoaXMuX3ByZXJlbmRlckdyb3VwID0gcGF0aC5ncm91cCgpO1xuXHRcdHRoaXMuX2hhbmRsZUdyb3VwID0gcGF0aC5ncm91cCgpO1xuXHRcdHRoaXMuX3Bvc3RyZW5kZXJHcm91cCA9IHBhdGguZ3JvdXAoe25vSGl0OnRydWV9KTtcblxuXG5cdFx0dGhpcy5fc2NlbmUuYWRkQ2hpbGQodGhpcy5fcHJlcmVuZGVyR3JvdXApO1xuXHRcdHRoaXMuX3NjZW5lLmFkZENoaWxkKHRoaXMuX2hhbmRsZUdyb3VwKTtcblx0XHR0aGlzLl9saW5rcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmspIHtcblxuXHRcdFx0dmFyIGxpbmtPYmplY3Q7XG5cdFx0XHRpZiAoIWxpbmsudHlwZSkge1xuXHRcdFx0XHRsaW5rLnR5cGUgPSBMSU5LX1RZUEUuREVGQVVMVDtcblx0XHRcdH1cblx0XHRcdHN3aXRjaChsaW5rLnR5cGUpIHtcblx0XHRcdFx0Y2FzZSBMSU5LX1RZUEUuQVJST1c6XG5cdFx0XHRcdFx0bGluay5oZWFkT2Zmc2V0ID0gbGluay50YXJnZXQucmFkaXVzO1xuXHRcdFx0XHRcdGxpbmtPYmplY3QgPSBwYXRoLmFycm93KGxpbmspO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIExJTktfVFlQRS5BUkM6XG5cdFx0XHRcdFx0bGlua09iamVjdCA9IHBhdGguYXJjKGxpbmspO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIExJTktfVFlQRS5MSU5FOlxuXHRcdFx0XHRjYXNlIExJTktfVFlQRS5ERUZBVUxUOlxuXHRcdFx0XHRcdGxpbmtPYmplY3QgPSBwYXRoLmxpbmUobGluayk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0bGlua09iamVjdCA9IHBhdGgubGluZShsaW5rKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHRoYXQuX25vZGVJbmRleFRvTGlua0xpbmVbbGluay5zb3VyY2UuaW5kZXhdLnB1c2gobGlua09iamVjdCk7XG5cdFx0XHR0aGF0Ll9ub2RlSW5kZXhUb0xpbmtMaW5lW2xpbmsudGFyZ2V0LmluZGV4XS5wdXNoKGxpbmtPYmplY3QpO1xuXG5cdFx0XHR0aGF0Ll9zY2VuZS5hZGRDaGlsZChsaW5rT2JqZWN0KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX25vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0dmFyIGNpcmNsZSA9IHBhdGguY2lyY2xlKG5vZGUpO1xuXHRcdFx0dGhhdC5fbm9kZUluZGV4VG9DaXJjbGVbbm9kZS5pbmRleF0gPSBjaXJjbGU7XG5cdFx0XHRpZiAodGhhdC5fbm9kZU92ZXIgfHwgdGhhdC5fZHJhZ2dhYmxlKSB7XG5cdFx0XHRcdGNpcmNsZS5vZmYoJ21vdXNlb3ZlcicpO1xuXHRcdFx0XHRjaXJjbGUub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRpZiAodGhhdC5fZXZlbnRzU3VzcGVuZGVkKCkpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0aWYgKHRoYXQuX25vZGVPdmVyKSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9ub2RlT3ZlcihjaXJjbGUsIGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSE9PSdkcmFnZ2luZycpIHtcblx0XHRcdFx0XHRcdHRoYXQuX2N1cnJlbnRPdmVyTm9kZSA9IGNpcmNsZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhhdC5fc2NlbmUudXBkYXRlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoYXQuX25vZGVPdXQgfHwgdGhhdC5fZHJhZ2dhYmxlKSB7XG5cdFx0XHRcdGNpcmNsZS5vZmYoJ21vdXNlb3V0Jyk7XG5cdFx0XHRcdGNpcmNsZS5vbignbW91c2VvdXQnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICh0aGF0Ll9jdXJyZW50TW92ZVN0YXRlIT09J2RyYWdnaW5nJykge1xuXHRcdFx0XHRcdFx0dGhhdC5fY3VycmVudE92ZXJOb2RlID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoYXQuX25vZGVPdXQpIHtcblx0XHRcdFx0XHRcdHRoYXQuX25vZGVPdXQoY2lyY2xlLCBlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhhdC5fc2NlbmUudXBkYXRlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoYXQuX25vZGVDbGljaykge1xuXHRcdFx0XHRjaXJjbGUub2ZmKCdjbGljaycpO1xuXHRcdFx0XHRjaXJjbGUub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9ldmVudHNTdXNwZW5kZWQoKSkgeyByZXR1cm47IH1cblx0XHRcdFx0XHR0aGF0Ll9ub2RlQ2xpY2soY2lyY2xlLGUpO1xuXHRcdFx0XHRcdHRoYXQuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAodGhhdC5fZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0XHRcdGNpcmNsZS5vZmYoJ2NsaWNrJyk7XG5cdFx0XHRcdGNpcmNsZS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICh0aGF0Ll9ub2RlT3V0KSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9ub2RlT3V0KGNpcmNsZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoYXQudW5ncm91cChjaXJjbGUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHRoYXQuX3NjZW5lLmFkZENoaWxkKGNpcmNsZSk7XG5cblx0XHRcdGlmIChub2RlLmxhYmVsKSB7XG5cdFx0XHRcdHRoYXQuYWRkTGFiZWwobm9kZSxub2RlLmxhYmVsKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLnNob3dBbGxMYWJlbHMoKSkge1xuXHRcdFx0dGhpcy5zaG93QWxsTGFiZWxzKHRydWUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xheW91dGVyLmxpbmtNYXAodGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSlcblx0XHRcdC5ub2RlTWFwKHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlKVxuXHRcdFx0LmxhYmVsTWFwKHRoaXMuX25vZGVJbmRleFRvTGFiZWwpO1xuXG5cblx0XHR0aGlzLl9hZGRQcmVBbmRQb3N0UmVuZGVyT2JqZWN0cygpO1xuXG5cdFx0Ly8gRHJhdyBhbnkgdW5ncm91cGVkIG5vZGUgYm91bmRpbmcgYm94ZXNcblx0XHR0aGlzLl9hZGRSZWdyb3VwSGFuZGxlcygpO1xuXG5cdFx0dGhpcy5fc2NlbmUuYWRkQ2hpbGQodGhpcy5fcG9zdHJlbmRlckdyb3VwKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIERlYnVnIHJvdXRpbmcgdG8gZHJhdyBhIGJvdW5kaW5nIGJveCBhcm91bmQgdGhlIG5vZGVzXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfZGVidWdEcmF3Qm91bmRpbmdCb3ggOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgYkluY2x1ZGVMYWJlbHMgPSB0cnVlO1xuXHRcdHZhciBib3VuZGluZ0JveCA9IHRoaXMuX2xheW91dGVyLmdldEJvdW5kaW5nQm94KHRoaXMuX25vZGVzLHVuZGVmaW5lZCxiSW5jbHVkZUxhYmVscyk7XG5cdFx0aWYgKHRoaXMuX2JiUmVuZGVyKSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0aGlzLl9iYlJlbmRlcik7XG5cdFx0fVxuXHRcdHRoaXMuX2JiUmVuZGVyID0gcGF0aC5yZWN0KHtcblx0XHRcdHggOiBib3VuZGluZ0JveC54LFxuXHRcdFx0eSA6IGJvdW5kaW5nQm94LnksXG5cdFx0XHR3aWR0aCA6IGJvdW5kaW5nQm94LndpZHRoLFxuXHRcdFx0aGVpZ2h0IDogYm91bmRpbmdCb3guaGVpZ2h0LFxuXHRcdFx0c3Ryb2tlU3R5bGUgOiAnI2ZmMDAwMCcsXG5cdFx0XHRsaW5lV2lkdGggOiAyLFxuXHRcdFx0bm9IaXQgOiB0cnVlXG5cdFx0fSk7XG5cdFx0dGhpcy5fc2NlbmUuYWRkQ2hpbGQodGhpcy5fYmJSZW5kZXIpO1xuXHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBGaXQgdGhlIGdyYXBoIHRvIHRoZSBzY3JlZW5cblx0ICovXG5cdGZpdCA6IGZ1bmN0aW9uKHBhZGRpbmcpIHtcblxuXHRcdC8vIFJldHVybiBiYWNrIHRvIG9yaWdpblxuXHRcdHRoaXMuX3BhbigtdGhpcy5fc2NlbmUueCwtdGhpcy5fc2NlbmUueSk7XG5cblxuXG5cdFx0Ly8gV29ya2luZyB3aXRoIGJpZyBudW1iZXJzLCBpdCdzIGJldHRlciBpZiB3ZSBkbyB0aGlzIHR3aWNlLlxuXHRcdHZhciBib3VuZGluZ0JveDtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IDI7IGkrKykge1xuXHRcdFx0Ym91bmRpbmdCb3ggPSB0aGlzLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveCh0aGlzLl9ub2RlcyxwYWRkaW5nKTtcblx0XHRcdHZhciB4UmF0aW8gPSB0aGlzLl9zY2VuZS53aWR0aCAvIGJvdW5kaW5nQm94LndpZHRoO1xuXHRcdFx0dmFyIHlSYXRpbyA9IHRoaXMuX3NjZW5lLmhlaWdodCAvIGJvdW5kaW5nQm94LmhlaWdodDtcblx0XHRcdHRoaXMuX3pvb20oTWF0aC5taW4oeFJhdGlvLCB5UmF0aW8pLCAwLCAwKTtcblx0XHR9XG5cblx0XHR2YXIgbWlkU2NyZWVuWCA9IHRoaXMuX3NjZW5lLndpZHRoIC8gMjtcblx0XHR2YXIgbWlkU2NyZWVuWSA9IHRoaXMuX3NjZW5lLmhlaWdodCAvIDI7XG5cdFx0Ym91bmRpbmdCb3ggPSB0aGlzLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveCh0aGlzLl9ub2Rlcyk7XG5cdFx0dmFyIG1pZEJCWCA9IGJvdW5kaW5nQm94LnggKyBib3VuZGluZ0JveC53aWR0aCAvIDI7XG5cdFx0dmFyIG1pZEJCWSA9IGJvdW5kaW5nQm94LnkgKyBib3VuZGluZ0JveC5oZWlnaHQgLyAyO1xuXHRcdHRoaXMuX3BhbigtKG1pZEJCWC1taWRTY3JlZW5YKSwtKG1pZEJCWS1taWRTY3JlZW5ZKSk7XG5cblx0XHR0aGlzLl96b29tU2NhbGUgPSAxLjA7XG5cdFx0dGhpcy5fbGF5b3V0ZXIuX3pvb21TY2FsZSA9IDEuMDtcblx0XHQvLyBab29tIHRoZSByZW5kZXIgZ3JvdXBzXG5cdFx0Ly9pZiAodGhpcy5fcHJlcmVuZGVyR3JvdXApIHtcblx0XHQvL1x0dGhpcy5fcHJlcmVuZGVyR3JvdXAuc2NhbGVYID0gdGhpcy5fem9vbVNjYWxlO1xuXHRcdC8vXHR0aGlzLl9wcmVyZW5kZXJHcm91cC5zY2FsZVkgPSB0aGlzLl96b29tU2NhbGU7XG5cdFx0Ly99XG5cdFx0Ly9pZiAodGhpcy5fcG9zdHJlbmRlckdyb3VwKSB7XG5cdFx0Ly9cdHRoaXMuX3Bvc3RyZW5kZXJHcm91cC5zY2FsZVggPSB0aGlzLl96b29tU2NhbGU7XG5cdFx0Ly9cdHRoaXMuX3Bvc3RyZW5kZXJHcm91cC5zY2FsZVkgPSB0aGlzLl96b29tU2NhbGU7XG5cdFx0Ly99XG5cdFx0dGhpcy51cGRhdGUoKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTdXNwZW5kIG1vdXNlIGV2ZW50cyBhbmQgem9vbWluZ1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3N1c3BlbmRFdmVudHMgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9sYXlvdXRlci5fZXZlbnRzU3VzcGVuZGVkID0gdHJ1ZTtcblx0fSxcblxuXHQvKipcblx0ICogcmVzdW1lIG1vdXNlIGV2ZW50cyBhbmQgem9vbWluZ1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3Jlc3VtZUV2ZW50cyA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX2xheW91dGVyLl9ldmVudHNTdXNwZW5kZWQgPSBmYWxzZTtcblx0fSxcblxuXHQvKipcblx0ICogUXVlcnkgZXZlbnQgc3VzcGVuc2lvbiBzdGF0dXNcblx0ICogQHJldHVybnMgYm9vbGVhblxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2V2ZW50c1N1c3BlbmRlZCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRlci5fZXZlbnRzU3VzcGVuZGVkO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZW1vdmVzIGFsbCByZW5kZXIgb2JqZWN0cyBhc3NvY2lhdGVkIHdpdGggYSBncmFwaC5cblx0ICovXG5cdGNsZWFyIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHJlbW92ZVJlbmRlck9iamVjdHMgPSBmdW5jdGlvbihpbmRleFRvT2JqZWN0KSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gaW5kZXhUb09iamVjdCkge1xuXHRcdFx0XHRpZiAoaW5kZXhUb09iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdFx0dmFyIG9iaiA9IGluZGV4VG9PYmplY3Rba2V5XTtcblx0XHRcdFx0XHRpZiAoJC5pc0FycmF5KG9iaikpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKG9ialtpXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRlbGV0ZSBpbmRleFRvT2JqZWN0W2tleV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJlbW92ZVJlbmRlck9iamVjdHMuY2FsbCh0aGlzLHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlKTtcblx0XHRyZW1vdmVSZW5kZXJPYmplY3RzLmNhbGwodGhpcyx0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lKTtcblx0XHRyZW1vdmVSZW5kZXJPYmplY3RzLmNhbGwodGhpcyx0aGlzLl9ub2RlSW5kZXhUb0xhYmVsKTtcblx0XHRpZiAodGhpcy5fcHJlcmVuZGVyR3JvdXApIHtcblx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKHRoaXMuX3ByZXJlbmRlckdyb3VwKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2hhbmRsZUdyb3VwKSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0aGlzLl9oYW5kbGVHcm91cCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9wb3N0cmVuZGVyR3JvdXApIHtcblx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKHRoaXMuX3Bvc3RyZW5kZXJHcm91cCk7XG5cdFx0fVxuXHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdHRvSW1hZ2VVUkkgOiBmdW5jdGlvbihiVmlzaWJsZSkge1xuXHRcdHZhciBkID0gbmV3ICQuRGVmZXJyZWQoKTtcblxuXHRcdGlmIChiVmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuIGQucmVzb2x2ZSh0aGlzLl9jYW52YXMudG9EYXRhVVJMKCkpO1xuXHRcdH1cblxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR2YXIgb3JpZ2luYWxEdXJhdGlvbiA9IHRoaXMuX2xheW91dGVyLl9kdXJhdGlvbjtcblx0XHR0aGlzLl9sYXlvdXRlci5fZHVyYXRpb24gPSAxO1xuXG5cdFx0dmFyIGNhcHR1cmVDYW52YXMgPSAkKCc8Y2FudmFzLz4nKS5hcHBlbmRUbygkKGRvY3VtZW50LmJvZHkpKTtcblxuXHRcdHZhciBvbkxheW91dEZpbmlzaGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRjYXB0dXJlR3JhcGguX2xheW91dGVyLnBvc3RyZW5kZXJVcGRhdGUoKTtcblx0XHRcdHZhciBwYWRkaW5nID0gMTUwO1xuXHRcdFx0dmFyIGJvdW5kaW5nQm94ID0gY2FwdHVyZUdyYXBoLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveChjYXB0dXJlR3JhcGgubm9kZXMoKSwwLHRydWUpO1xuXHRcdFx0Y2FwdHVyZUdyYXBoLnJlc2l6ZShib3VuZGluZ0JveC53aWR0aCtwYWRkaW5nLGJvdW5kaW5nQm94LmhlaWdodCtwYWRkaW5nKTtcblx0XHRcdGNhcHR1cmVHcmFwaC5fcGFuKC1ib3VuZGluZ0JveC54KyhwYWRkaW5nLzIpLC1ib3VuZGluZ0JveC55ICsgKHBhZGRpbmcvMikpO1xuXG5cdFx0XHR2YXIgdXJpID0gY2FwdHVyZUNhbnZhc1swXS50b0RhdGFVUkwoKTtcblx0XHRcdGNhcHR1cmVDYW52YXMucmVtb3ZlKCk7XG5cblx0XHRcdHRoYXQuX2xheW91dGVyLl9zY2VuZS5pc0V4cG9ydCA9IGZhbHNlO1xuXHRcdFx0dGhhdC5jbGVhcigpXG5cdFx0XHRcdC5ub2Rlcyh0aGF0Ll9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZE5vZGVzKCkpXG5cdFx0XHRcdC5saW5rcyh0aGF0Ll9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZExpbmtzKCkpXG5cdFx0XHRcdC5kcmF3KCk7XG5cblx0XHRcdHRoYXQuX2xheW91dGVyLl9hcHBseVpvb21TY2FsZSh0cnVlKTtcblx0XHRcdHRoYXQubGF5b3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGF0Ll9sYXlvdXRlci5fZHVyYXRpb24gPSBvcmlnaW5hbER1cmF0aW9uO1xuXHRcdFx0XHRkLnJlc29sdmUodXJpKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhhdC5fbGF5b3V0ZXIuX2FwcGx5Wm9vbVNjYWxlKGZhbHNlKTtcblx0XHR9O1xuXG5cdFx0dmFyIGNhcHR1cmVHcmFwaCA9IG5ldyBHcmFwaCgpXG5cdFx0XHQuY2FudmFzKGNhcHR1cmVDYW52YXNbMF0pXG5cdFx0XHQubm9kZXModGhpcy5ub2RlcygpKVxuXHRcdFx0LmxheW91dGVyKHRoaXMuX2xheW91dGVyKVxuXHRcdFx0LmxpbmtzKHRoaXMubGlua3MoKSlcblx0XHRcdC5mb250Q29sb3VyKHRoaXMuX2ZvbnRDb2xvcilcblx0XHRcdC5mb250RmFtaWx5KHRoaXMuX2ZvbnRGYW1pbHkpXG5cdFx0XHQuZm9udFNpemUodGhpcy5fZm9udFNpemUpO1xuXG5cdFx0dmFyIGZzID0gdGhpcy5mb250U2hhZG93KCk7XG5cdFx0aWYgKGZzKSB7XG5cdFx0XHRjYXB0dXJlR3JhcGguZm9udFNoYWRvdyhmcy5jb2xvciwgZnMub2Zmc2V0WCwgZnMub2Zmc2V0WSwgZnMuYmx1cik7XG5cdFx0fVxuXHRcdGNhcHR1cmVHcmFwaC5kcmF3KCk7XG5cblx0XHRjYXB0dXJlR3JhcGguX3NjZW5lLmlzRXhwb3J0ID0gdHJ1ZTtcblxuXHRcdGlmICh0aGlzLl9zaG93QWxsTGFiZWxzKSB7XG5cdFx0XHRmb3IgKHZhciBuSWR4IGluIHRoaXMuX25vZGVJbmRleFRvTGFiZWwpIHtcblx0XHRcdFx0aWYgKHRoaXMuX25vZGVJbmRleFRvTGFiZWwuaGFzT3duUHJvcGVydHkobklkeCkpIHtcblx0XHRcdFx0XHRjYXB0dXJlR3JhcGguYWRkTGFiZWwodGhpcy5ub2RlV2l0aEluZGV4KG5JZHgpLHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbklkeF0udGV4dCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y2FwdHVyZUdyYXBoLmxheW91dChvbkxheW91dEZpbmlzaGVkKTtcblxuXHRcdHJldHVybiBkLnByb21pc2UoKTtcblx0fVxufSk7XG5cblxuZXhwb3J0cy5MSU5LX1RZUEUgPSByZXF1aXJlKCcuL2xpbmtUeXBlJyk7XG5leHBvcnRzLkdyb3VwaW5nTWFuYWdlciA9IHJlcXVpcmUoJy4vZ3JvdXBpbmdNYW5hZ2VyJyk7XG5leHBvcnRzLkxheW91dCA9IHJlcXVpcmUoJy4vbGF5b3V0Jyk7XG5leHBvcnRzLkNvbHVtbkxheW91dCA9IHJlcXVpcmUoJy4vY29sdW1uTGF5b3V0Jyk7XG5leHBvcnRzLlJhZGlhbExheW91dCA9IHJlcXVpcmUoJy4vcmFkaWFsTGF5b3V0Jyk7XG5leHBvcnRzLkV4dGVuZCA9IF8uZXh0ZW5kO1xuZXhwb3J0cy5HcmFwaCA9IEdyYXBoOyIsInZhciBfID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgTGF5b3V0ID0gcmVxdWlyZSgnLi9sYXlvdXQnKTtcbi8qKlxuICpcbiAqIEBwYXJhbSBmb2N1cyAtIHRoZSBub2RlIGF0IHRoZSBjZW50ZXIgb2YgdGhlIHJhZGlhbCBsYXlvdXRcbiAqIEBwYXJhbSBkaXN0YW5jZSAtIHRoZSBkaXN0YW5jZSBvZiBvdGhlciBub2RlcyBmcm9tIHRoZSBmb2N1c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJhZGlhbExheW91dChmb2N1cyxkaXN0YW5jZSkge1xuXHR0aGlzLl9mb2N1cyA9IGZvY3VzO1xuXHR0aGlzLl9kaXN0YW5jZSA9IGRpc3RhbmNlO1xuXG5cdExheW91dC5hcHBseSh0aGlzKTtcbn1cblxuXG5SYWRpYWxMYXlvdXQucHJvdG90eXBlID0gXy5leHRlbmQoUmFkaWFsTGF5b3V0LnByb3RvdHlwZSwgTGF5b3V0LnByb3RvdHlwZSwge1xuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBkaXN0YW5jZSBwYXJhbWV0ZXJcblx0ICogQHBhcmFtIGRpc3RhbmNlIC0gdGhlIGRpc3RhbmNlIG9mIGxpbmtzIGZyb20gdGhlIGZvY3VzIG5vZGUgdG8gb3RoZXIgbm9kZXMgaW4gcGl4ZWxzXG5cdCAqIEByZXR1cm5zIHtSYWRpYWxMYXlvdXR9IGlmIGRpc3RhbmNlIHBhcmFtIGlzIGRlZmluZWQsIHtSYWRpYWxMYXlvdXQuX2Rpc3RhbmNlfSBvdGhlcndpc2Vcblx0ICovXG5cdGRpc3RhbmNlOiBmdW5jdGlvbiAoZGlzdGFuY2UpIHtcblx0XHRpZiAoZGlzdGFuY2UpIHtcblx0XHRcdHRoaXMuX2Rpc3RhbmNlID0gZGlzdGFuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9kaXN0YW5jZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9jdXMgbm9kZSB0aGF0IGlzIGF0IHRoZSBjZW50ZXIgb2YgdGhlIGxheW91dFxuXHQgKiBAcGFyYW0gZm9jdXMgLSB0aGUgbm9kZSB0aGF0IGlzIGF0IHRoZSBjZW50ZXIgb2YgdGhlIGxheW91dC4gICBPdGhlciBub2RlcyBhcmUgY2VudGVyZWQgYXJvdW5kIHRoaXMuXG5cdCAqIEByZXR1cm5zIHtSYWRpYWxMYXlvdXR9IGlmIGZvY3VzIHBhcmFtIGlzIGRlZmluZWQsIHtSYWRpYWxMYXlvdXQuX2ZvY3VzfSBvdGhlcndpc2Vcblx0ICovXG5cdGZvY3VzOiBmdW5jdGlvbiAoZm9jdXMpIHtcblx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdHRoaXMuX2ZvY3VzID0gZm9jdXM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb2N1cztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCB0aGUgbGFiZWwgcG9zaXRpb24gZm9yIGEgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVggLSB0aGUgeCBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVkgLSB0aGUgeSBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gcmFkaXVzIC0gdGhlIHJhZGl1cyBvZiB0aGUgbm9kZVxuXHQgKiBAcmV0dXJucyB7e3g6IHggcG9zaXRpb24gb2YgdGhlIGxhYmVsLCB5OiB5IHBvc2l0aW9uIG9mIHRoZSBsYWJlbCwgYWxpZ246IEhUTUwgY2FudmFzIHRleHQgYWxpZ25tZW50IHByb3BlcnR5IGZvciBsYWJlbH19XG5cdCAqL1xuXHRsYXlvdXRMYWJlbDogZnVuY3Rpb24gKG5vZGVYLCBub2RlWSwgcmFkaXVzKSB7XG5cdFx0dmFyIHgsIHksIGFsaWduO1xuXG5cdFx0Ly8gUmlnaHQgb2YgY2VudGVyXG5cdFx0aWYgKG5vZGVYID4gdGhpcy5fZm9jdXMpIHtcblx0XHRcdHggPSBub2RlWCArIChyYWRpdXMgKyAxMCk7XG5cdFx0XHRhbGlnbiA9ICdzdGFydCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHggPSBub2RlWCAtIChyYWRpdXMgKyAxMCk7XG5cdFx0XHRhbGlnbiA9ICdlbmQnO1xuXHRcdH1cblxuXHRcdGlmIChub2RlWSA+IHRoaXMuX2ZvY3VzKSB7XG5cdFx0XHR5ID0gbm9kZVkgKyAocmFkaXVzICsgMTApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR5ID0gbm9kZVkgLSAocmFkaXVzICsgMTApO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0eDogeCxcblx0XHRcdHk6IHksXG5cdFx0XHRhbGlnbjogYWxpZ25cblx0XHR9O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBQZXJmb3JtIGEgcmFkaWFsIGxheW91dFxuXHQgKiBAcGFyYW0gdyAtIHRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIGJlaW5nIHJlbmRlcmVkIHRvXG5cdCAqIEBwYXJhbSBoIC0gdGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIGJlaW5nIHJlbmRlcmVkIHRvXG5cdCAqL1xuXHRsYXlvdXQ6IGZ1bmN0aW9uICh3LCBoKSB7XG5cdFx0dmFyIG5vZGVzID0gdGhpcy5ub2RlcygpO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR2YXIgYW5nbGVEZWx0YSA9IE1hdGguUEkgKiAyIC8gKG5vZGVzLmxlbmd0aCAtIDEpO1xuXHRcdHZhciBhbmdsZSA9IDAuMDtcblx0XHRub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG5cdFx0XHRpZiAobm9kZS5pbmRleCA9PT0gdGhhdC5fZm9jdXMuaW5kZXgpIHtcblx0XHRcdFx0dGhhdC5fc2V0Tm9kZVBvc2l0aW9uKG5vZGUsIG5vZGUueCwgbm9kZS55KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIG5ld1ggPSB0aGF0Ll9mb2N1cy54ICsgKE1hdGguY29zKGFuZ2xlKSAqIHRoYXQuX2Rpc3RhbmNlKTtcblx0XHRcdHZhciBuZXdZID0gdGhhdC5fZm9jdXMueSArIChNYXRoLnNpbihhbmdsZSkgKiB0aGF0Ll9kaXN0YW5jZSk7XG5cdFx0XHR0aGF0Ll9zZXROb2RlUG9zaXRpb24obm9kZSwgbmV3WCwgbmV3WSk7XG5cdFx0XHRhbmdsZSArPSBhbmdsZURlbHRhO1xuXHRcdH0pO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSYWRpYWxMYXlvdXQ7XG4iLCJcbnZhciBVdGlsID0ge1xuXG4gIGV4dGVuZDogZnVuY3Rpb24oZGVzdCwgc291cmNlcykge1xuICAgIHZhciBrZXksIGksIHNvdXJjZTtcbiAgICBmb3IgKGk9MTsgaTxhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoa2V5IGluIHNvdXJjZSkge1xuICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICBkZXN0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVzdDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVdGlsOyJdfQ==
(5)
});
