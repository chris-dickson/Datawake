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
		var top = -this._scene.y;
		var left = -this._scene.x;

		this._layouter.postrenderUpdate(left,top,left+this._scene.width,top+this._scene.height);
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

	toImageURI : function() {
		var d = new $.Deferred();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2NvbHVtbkxheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2dyb3VwaW5nTWFuYWdlci5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2xheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2xpbmtUeXBlLmpzIiwiL1VzZXJzL2NkaWNrc29uL0RvY3VtZW50cy93b3Jrc3BhY2UvZ3JhcGhqcy9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL3JhZGlhbExheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25XQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcllBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBfID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgTGF5b3V0ID0gcmVxdWlyZSgnLi9sYXlvdXQnKTtcblxudmFyIENvbHVtbkxheW91dCA9IGZ1bmN0aW9uKCkge1xuXHRMYXlvdXQuYXBwbHkodGhpcyk7XG59O1xuXG5Db2x1bW5MYXlvdXQucHJvdG90eXBlID0gXy5leHRlbmQoQ29sdW1uTGF5b3V0LnByb3RvdHlwZSwgTGF5b3V0LnByb3RvdHlwZSwge1xuXG5cdC8qKlxuXHQgKiBBIGNvbHVtbiBsYXlvdXRcblx0ICogQHBhcmFtIHcgLSB3aWR0aCBvZiBjYW52YXNcblx0ICogQHBhcmFtIGggLSBoZWlnaHQgb2YgY2FudmFzXG5cdCAqL1xuXHRsYXlvdXQgOiBmdW5jdGlvbiAodywgaCkge1xuXHRcdHZhciB4ID0gMDtcblx0XHR2YXIgeSA9IDA7XG5cdFx0dmFyIG1heFJhZGl1c0NvbCA9IDA7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX25vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcblxuXHRcdFx0aWYgKHkgPT09IDApIHtcblx0XHRcdFx0eSArPSBub2RlLnJhZGl1cztcblx0XHRcdH1cblx0XHRcdGlmICh4ID09PSAwKSB7XG5cdFx0XHRcdHggKz0gbm9kZS5yYWRpdXM7XG5cdFx0XHR9XG5cblx0XHRcdHRoYXQuX3NldE5vZGVQb3NpdGlvbkltbWVkaWF0ZShub2RlLCB4LCB5KTtcblxuXHRcdFx0bWF4UmFkaXVzQ29sID0gTWF0aC5tYXgobWF4UmFkaXVzQ29sLCBub2RlLnJhZGl1cyk7XG5cblx0XHRcdHkgKz0gbm9kZS5yYWRpdXMgKyA0MDtcblx0XHRcdGlmICh5ID4gaCkge1xuXHRcdFx0XHR5ID0gMDtcblx0XHRcdFx0eCArPSBtYXhSYWRpdXNDb2wgKyA0MDtcblx0XHRcdFx0bWF4UmFkaXVzQ29sID0gMDtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sdW1uTGF5b3V0O1xuIiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgYmFzZSBncm91cGluZyBtYW5hZ2VyLiAgIFRoaXMgaXMgYW4gYWJzdHJhY3QgY2xhc3MuICAgQ2hpbGQgY2xhc3NlcyBzaG91bGQgb3ZlcnJpZGUgdGhlXG4gKiBpbml0aWFsaXplSGVpcmFyY2h5IGZ1bmN0aW9uIHRvIGNyZWF0ZSBub2Rlcy9saW5rcyB0aGF0IGFyZSBhZ2dyZWdhdGVkIGZvciB0aGVpciBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvblxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBHcm91cGluZ01hbmFnZXIgPSBmdW5jdGlvbihhdHRyaWJ1dGVzKSB7XG5cdHRoaXMuX2luaXRpYWxpemUoKTtcblx0Xy5leHRlbmQodGhpcyxhdHRyaWJ1dGVzKTtcbn07XG5cbkdyb3VwaW5nTWFuYWdlci5wcm90b3R5cGUgPSBfLmV4dGVuZChHcm91cGluZ01hbmFnZXIucHJvdG90eXBlLCB7XG5cdF9pbml0aWFsaXplIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5fbm9kZXMgPSBbXTtcblx0XHR0aGlzLl9saW5rcyA9IFtdO1xuXG5cdFx0dGhpcy5fYWdncmVnYXRlZE5vZGVzID0gW107XG5cdFx0dGhpcy5fYWdncmVnYXRlZExpbmtzID0gW107XG5cdFx0dGhpcy5fYWdncmVnYXRlTm9kZU1hcCA9IHt9O1xuXG5cdFx0dGhpcy5fdW5ncm91cGVkQWdncmVnYXRlcyA9IHt9O1xuXHRcdHRoaXMuX3VuZ3JvdXBlZE5vZGVHcm91cHMgPSB7fTtcblx0fSxcblxuXHQvKipcblx0ICogUmVzZXQgaGVpcmFyY2h5XG5cdCAqL1xuXHRjbGVhciA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX2luaXRpYWxpemUoKTtcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBvcmlnaW5hbCBub2RlcyBpbiB0aGUgZ3JhcGggd2l0aG91dCBncm91cGluZ1xuXHQgKiBAcGFyYW0gbm9kZXMgLSBhIGdyYXBoLmpzIG5vZGUgYXJyYXlcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRub2RlcyA6IGZ1bmN0aW9uKG5vZGVzKSB7XG5cdFx0aWYgKG5vZGVzKSB7XG5cdFx0XHR0aGlzLl9ub2RlcyA9IG5vZGVzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbm9kZXM7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIG9yaWdpbmFsIGxpbmtzIGluIHRoZSBncmFwaCB3aXRob3V0IGdyb3VwaW5nXG5cdCAqIEBwYXJhbSBsaW5rcyAtIGEgZ3JhcGguanMgbGluayBhcnJheVxuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdGxpbmtzIDogZnVuY3Rpb24obGlua3MpIHtcblx0XHRpZiAobGlua3MpIHtcblx0XHRcdHRoaXMuX2xpbmtzID0gbGlua3M7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9saW5rcztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemVzIHRoZSBub2RlL2xpbmsgYWdncmVnYXRpb25cblx0ICovXG5cdGluaXRpYWxpemVIZWlyYXJjaHkgOiBmdW5jdGlvbigpIHtcblxuXHRcdHRoaXMuX3VuZ3JvdXBlZEFnZ3JlZ2F0ZXMgPSB7fTtcblx0XHR0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzID0ge307XG5cblx0XHR0aGlzLl9hZ2dyZWdhdGVOb2RlcygpO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZUxpbmtzKCk7XG5cblx0XHR2YXIgc2V0UGFyZW50UG9pbnRlcnMgPSBmdW5jdGlvbihub2RlLHBhcmVudCkge1xuXHRcdFx0aWYgKG5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0bm9kZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG5cdFx0XHRcdFx0c2V0UGFyZW50UG9pbnRlcnMoY2hpbGQsbm9kZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0bm9kZS5wYXJlbnROb2RlID0gcGFyZW50O1xuXHRcdH07XG5cblx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuZm9yRWFjaChmdW5jdGlvbihub2RlKSB7XG5cdFx0XHRzZXRQYXJlbnRQb2ludGVycyhub2RlLG51bGwpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMub25BZ2dyZWdhdGlvbkNvbXBsZXRlKSB7XG5cdFx0XHR0aGlzLm9uQWdncmVnYXRpb25Db21wbGV0ZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBhZ2dyZWdhdGVkIGxpbmsgaW4gZ3JhcGguanMgZm9ybWF0LiAgIENhbiBiZSBvdmVycmlkZW4gYnkgc3BlY2lmaWMgaW1wbGVtZW50YXRpb25zIHRvIGFsbG93XG5cdCAqIHRvIGFsbG93IGZvciBkaWZlcmVudCBsaW5rIHR5cGVzIGJhc2VkIG9uIGFnZ3JlZ2F0ZSBjb250ZW50c1xuXHQgKiBAcGFyYW0gc291cmNlQWdncmVnYXRlIC0gdGhlIHNvdXJjZSBhZ2dyZWdhdGUgbm9kZVxuXHQgKiBAcGFyYW0gdGFyZ2V0QWdncmVnYXRlIC0gdGhlIHRhcmdldCBhZ2dyZWdhdGUgbm9kZVxuXHQgKiBAcmV0dXJucyB7e3NvdXJjZTogKiwgdGFyZ2V0OiAqfX0gLSBhIGdyYXBoLmpzIGxpbmtcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9jcmVhdGVBZ2dyZWdhdGVMaW5rIDogZnVuY3Rpb24oc291cmNlQWdncmVnYXRlLHRhcmdldEFnZ3JlZ2F0ZSxvcmlnaW5hbExpbmtzKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNvdXJjZSA6IHNvdXJjZUFnZ3JlZ2F0ZSxcblx0XHRcdHRhcmdldCA6IHRhcmdldEFnZ3JlZ2F0ZVxuXHRcdH07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFBlcmZvcm1zIGxpbmsgYWdncmVnYXRlIGJhc2VkIG9uIGEgc2V0IG9mIGFnZ3JlZ2F0ZWQgbm9kZXMgYW5kIGEgZnVsbCBzZXQgb2YgbGlua3Ncblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9hZ2dyZWdhdGVMaW5rcyA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBub2RlSW5kZXhUb0FnZ3JlYWdhdGVOb2RlID0ge307XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKGFnZ3JlZ2F0ZSkge1xuXHRcdFx0aWYgKGFnZ3JlZ2F0ZS5jaGlsZHJlbikge1xuXHRcdFx0XHRhZ2dyZWdhdGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihub2RlKSB7XG5cdFx0XHRcdFx0bm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVtub2RlLmluZGV4XSA9IGFnZ3JlZ2F0ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRub2RlSW5kZXhUb0FnZ3JlYWdhdGVOb2RlW2FnZ3JlZ2F0ZS5pbmRleF0gPSBhZ2dyZWdhdGU7XG5cdFx0XHR9XG5cdFx0XHR0aGF0Ll9hZ2dyZWdhdGVOb2RlTWFwW2FnZ3JlZ2F0ZS5pbmRleF0gPSBhZ2dyZWdhdGU7XG5cdFx0fSk7XG5cblxuXHRcdHZhciBhZ2dyZWdhdGVkTGlua3MgPSBbXTtcblxuXHRcdHZhciBhZ2dyZWdhdGVMaW5rTWFwID0ge307XG5cblx0XHR0aGlzLl9saW5rcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmspIHtcblx0XHRcdHZhciBzb3VyY2VBZ2dyZWdhdGUgPSBub2RlSW5kZXhUb0FnZ3JlYWdhdGVOb2RlW2xpbmsuc291cmNlLmluZGV4XTtcblx0XHRcdHZhciB0YXJnZXRBZ2dyZWdhdGUgPSBub2RlSW5kZXhUb0FnZ3JlYWdhdGVOb2RlW2xpbmsudGFyZ2V0LmluZGV4XTtcblxuXHRcdFx0aWYgKCFzb3VyY2VBZ2dyZWdhdGUgfHwgIXRhcmdldEFnZ3JlZ2F0ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzb3VyY2VNYXAgPSBhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZS5pbmRleF07XG5cdFx0XHRpZiAoIXNvdXJjZU1hcCkge1xuXHRcdFx0XHRzb3VyY2VNYXAgPSB7fTtcblx0XHRcdH1cblx0XHRcdHZhciBzb3VyY2VUb1RhcmdldExpbmtzID0gc291cmNlTWFwW3RhcmdldEFnZ3JlZ2F0ZS5pbmRleF07XG5cdFx0XHRpZiAoIXNvdXJjZVRvVGFyZ2V0TGlua3MpIHtcblx0XHRcdFx0c291cmNlVG9UYXJnZXRMaW5rcyA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0c291cmNlVG9UYXJnZXRMaW5rcy5wdXNoKGxpbmspO1xuXHRcdFx0c291cmNlTWFwW3RhcmdldEFnZ3JlZ2F0ZS5pbmRleF0gPSBzb3VyY2VUb1RhcmdldExpbmtzO1xuXG5cdFx0XHRhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZS5pbmRleF0gPSBzb3VyY2VNYXA7XG5cdFx0fSk7XG5cblx0XHQvLyBHZXQgbWluL21heCBsaW5rIGNvdW50cyBmb3IgYWxsIGFnZ3JlZ2F0ZSBwYWlyc1xuXHRcdHZhciBtaW5Db3VudCA9IE51bWJlci5NQVhfVkFMVUU7XG5cdFx0dmFyIG1heENvdW50ID0gMDtcblx0XHRmb3IgKHZhciBzb3VyY2VBZ2dyZWdhdGVJZCBpbiBhZ2dyZWdhdGVMaW5rTWFwKSB7XG5cdFx0XHRpZiAoYWdncmVnYXRlTGlua01hcC5oYXNPd25Qcm9wZXJ0eShzb3VyY2VBZ2dyZWdhdGVJZCkpIHtcblx0XHRcdFx0Zm9yICh2YXIgdGFyZ2V0QWdncmVnYXRlSWQgaW4gYWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGVJZF0pIHtcblx0XHRcdFx0XHRpZiAoYWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGVJZF0uaGFzT3duUHJvcGVydHkodGFyZ2V0QWdncmVnYXRlSWQpKSB7XG5cdFx0XHRcdFx0XHR2YXIgc291cmNlID0gdGhhdC5fYWdncmVnYXRlTm9kZU1hcFtzb3VyY2VBZ2dyZWdhdGVJZF07XG5cdFx0XHRcdFx0XHR2YXIgdGFyZ2V0ID0gdGhhdC5fYWdncmVnYXRlTm9kZU1hcFt0YXJnZXRBZ2dyZWdhdGVJZF07XG5cdFx0XHRcdFx0XHR2YXIgb3JpZ2luYWxMaW5rcyA9IGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdW3RhcmdldEFnZ3JlZ2F0ZUlkXTtcblx0XHRcdFx0XHRcdG1pbkNvdW50ID0gTWF0aC5taW4obWluQ291bnQsb3JpZ2luYWxMaW5rcy5sZW5ndGgpO1xuXHRcdFx0XHRcdFx0bWF4Q291bnQgPSBNYXRoLm1heChtYXhDb3VudCxvcmlnaW5hbExpbmtzLmxlbmd0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yICh2YXIgc291cmNlQWdncmVnYXRlSWQgaW4gYWdncmVnYXRlTGlua01hcCkge1xuXHRcdFx0aWYgKGFnZ3JlZ2F0ZUxpbmtNYXAuaGFzT3duUHJvcGVydHkoc291cmNlQWdncmVnYXRlSWQpKSB7XG5cdFx0XHRcdGZvciAodmFyIHRhcmdldEFnZ3JlZ2F0ZUlkIGluIGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdKSB7XG5cdFx0XHRcdFx0aWYgKGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdLmhhc093blByb3BlcnR5KHRhcmdldEFnZ3JlZ2F0ZUlkKSkge1xuXHRcdFx0XHRcdFx0dmFyIHNvdXJjZSA9IHRoYXQuX2FnZ3JlZ2F0ZU5vZGVNYXBbc291cmNlQWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIHRhcmdldCA9IHRoYXQuX2FnZ3JlZ2F0ZU5vZGVNYXBbdGFyZ2V0QWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIG9yaWdpbmFsTGlua3MgPSBhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXVt0YXJnZXRBZ2dyZWdhdGVJZF07XG5cdFx0XHRcdFx0XHR2YXIgbGluayA9IHRoYXQuX2NyZWF0ZUFnZ3JlZ2F0ZUxpbmsoc291cmNlLCB0YXJnZXQsIG9yaWdpbmFsTGlua3MsIG1pbkNvdW50LCBtYXhDb3VudCk7XG5cdFx0XHRcdFx0XHRpZiAobGluaykge1xuXHRcdFx0XHRcdFx0XHRhZ2dyZWdhdGVkTGlua3MucHVzaChsaW5rKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9hZ2dyZWdhdGVkTGlua3MgPSBhZ2dyZWdhdGVkTGlua3M7XG5cdH0sXG5cblxuXHQvKipcblx0ICogUGVyZm9ybSBub2RlIGFnZ3JlZ2F0aW9uLiAgIE11c3QgYmUgb3ZlcnJpZGVuIGJ5IGltcGxlbWVudG9yc1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2FnZ3JlZ2F0ZU5vZGVzIDogZnVuY3Rpb24oKSB7XG5cblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgYWdncmVnYXRlZCBub2Rlc1xuXHQgKiBAcmV0dXJucyB7QXJyYXl9IG9mIGdyYXBoLmpzIG5vZGVzXG5cdCAqL1xuXHRhZ2dyZWdhdGVkTm9kZXMgOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fYWdncmVnYXRlZE5vZGVzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBhZ2dyZWdhdGVkIGxpbmtzXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gb2YgZ3JhcGguanMgbGlua3Ncblx0ICovXG5cdGFnZ3JlZ2F0ZWRMaW5rcyA6IGZ1bmN0aW9uKCkgIHtcblx0XHRyZXR1cm4gdGhpcy5fYWdncmVnYXRlZExpbmtzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgYSBub2RlIGZyb20gdGhlIGhlcmlhcmNoeVxuXHQgKiBAcGFyYW0gbm9kZVxuXHQgKi9cblx0cmVtb3ZlIDogZnVuY3Rpb24obm9kZSkge1xuXHRcdHZhciBpbmRleCA9IC0xO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fYWdncmVnYXRlZE5vZGVzLmxlbmd0aCAmJiBpbmRleCA9PT0gLTE7IGkrKykge1xuXHRcdFx0aWYgKHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlc1tpXS5pbmRleCA9PT0gbm9kZS5pbmRleCkge1xuXHRcdFx0XHRpbmRleCA9IGk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5zcGxpY2UoaW5kZXgsMSk7XG5cdFx0fVxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIERvIGFueSB1cGRhdGVzIG9uIGNoaWxkcmVuIGJlZm9yZSBsYXlvdXQgIChpZS8gc2V0IHBvc2l0aW9uLCByb3cvY29sIGluZm8sIGV0YykuICAgU2hvdWxkIGJlIGRlZmluZWRcblx0ICogaW4gaW1wbGVtZW50aW5nIGNsYXNzXG5cdCAqIEBwYXJhbSBhZ2dyZWdhdGVcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF91cGRhdGVDaGlsZHJlbiA6IGZ1bmN0aW9uKGFnZ3JlZ2F0ZSkge1xuXHRcdC8vIHNldCBjaGlsZHJlbnMgcG9zaXRpb24gaW5pdGlhbGx5IHRvIHRoZSBwb3NpdGlvbiBvZiB0aGUgYWdncmVnYXRlXG5cdFx0YWdncmVnYXRlLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcblx0XHRcdGNoaWxkLnggPSBhZ2dyZWdhdGUueDtcblx0XHRcdGNoaWxkLnkgPSBhZ2dyZWdhdGUueTtcblx0XHR9KTtcblx0fSxcblxuXHQvKipcblx0ICogVW5ncm91cCBhbiBhZ2dyZWdhdGUgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVxuXHQgKi9cblx0dW5ncm91cCA6IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRpZiAobm9kZS5jaGlsZHJlbikge1xuXG5cdFx0XHR2YXIgcGFyZW50S2V5ID0gJyc7XG5cdFx0XHRub2RlLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHRwYXJlbnRLZXkgKz0gbm9kZS5pbmRleCArICcsJztcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzW3BhcmVudEtleV0gPSBub2RlO1xuXG5cdFx0XHR2YXIgaW5kZXggPSAtMTtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fYWdncmVnYXRlZE5vZGVzLmxlbmd0aCAmJiBpbmRleCA9PT0gLTE7IGkrKykge1xuXHRcdFx0XHRpZiAodGhpcy5fYWdncmVnYXRlZE5vZGVzW2ldLmluZGV4ID09PSBub2RlLmluZGV4KSB7XG5cdFx0XHRcdFx0aW5kZXggPSBpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3VwZGF0ZUNoaWxkcmVuKG5vZGUpO1xuXG5cdFx0XHR2YXIgZmlyc3QgPSB0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuc2xpY2UoMCxpbmRleCk7XG5cdFx0XHR2YXIgbWlkZGxlID0gbm9kZS5jaGlsZHJlbjtcblx0XHRcdHRoaXMuX3VuZ3JvdXBlZE5vZGVHcm91cHNbcGFyZW50S2V5XSA9IG5vZGUuY2hpbGRyZW47XG5cdFx0XHR2YXIgZW5kID0gdGhpcy5fYWdncmVnYXRlZE5vZGVzLnNsaWNlKGluZGV4KzEpO1xuXG5cdFx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMgPSBmaXJzdC5jb25jYXQobWlkZGxlKS5jb25jYXQoZW5kKTtcblxuXHRcdFx0Ly8gUmVjb21wdXRlIGFnZ3JlZ2F0ZWQgbGlua3Ncblx0XHRcdHRoaXMuX2FnZ3JlZ2F0ZUxpbmtzKCk7XG5cdFx0XHRyZXR1cm4gcGFyZW50S2V5O1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgYWdncmVnYXRlIG5vZGUgZm9yIGFuIGV4cGFuZGVkIGdyb3VwXG5cdCAqIEBwYXJhbSBhZ2dyZWdhdGVLZXkgLSBrZXkgcmV0dXJuZWQgZnJvbSB1bmdyb3VwXG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0Z2V0QWdncmVnYXRlIDogZnVuY3Rpb24oYWdncmVnYXRlS2V5KSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VuZ3JvdXBlZEFnZ3JlZ2F0ZXNbYWdncmVnYXRlS2V5XTtcblx0fSxcblxuXHQvKipcblx0ICogUmVncm91cHMgYW4gdW5ncm91cGVkIGFnZ3JlZ2F0ZVxuXHQgKiBAcGFyYW0gYWdncmVnYXRlS2V5IC0ga2V5IHJldHVybmVkIGZyb20gdW5ncm91cFxuXHQgKiBAcGFyYW0gYXRJbmRleCAtIHJlaW5zZXJ0cyB0aGUgYWdncmVnYXRlIGF0IGEgc3BlY2lmaWMgcG9zaXRpb25cblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRyZWdyb3VwIDogZnVuY3Rpb24oYWdncmVnYXRlS2V5LGF0SW5kZXgpIHtcblx0XHR2YXIgYWdncmVnYXRlTm9kZSA9IHRoaXMuX3VuZ3JvdXBlZEFnZ3JlZ2F0ZXNbYWdncmVnYXRlS2V5XTtcblx0XHR2YXIgbm9kZXNUb1JlbW92ZSA9IGFnZ3JlZ2F0ZU5vZGUuY2hpbGRyZW47XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdG5vZGVzVG9SZW1vdmUuZm9yRWFjaChmdW5jdGlvbihub2RlKSB7XG5cdFx0XHR0aGF0LnJlbW92ZShub2RlKTtcblx0XHR9KTtcblx0XHR2YXIgc3RhcnQgPSB0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuc2xpY2UoMCxhdEluZGV4KTtcblx0XHR2YXIgZW5kID0gdGhpcy5fYWdncmVnYXRlZE5vZGVzLnNsaWNlKGF0SW5kZXgpO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZWROb2RlcyA9IHN0YXJ0LmNvbmNhdChhZ2dyZWdhdGVOb2RlKS5jb25jYXQoZW5kKTtcblx0XHR0aGlzLl9hZ2dyZWdhdGVMaW5rcygpO1xuXHRcdGRlbGV0ZSB0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzW2FnZ3JlZ2F0ZUtleV07XG5cdFx0ZGVsZXRlIHRoaXMuX3VuZ3JvdXBlZE5vZGVHcm91cHNbYWdncmVnYXRlS2V5XTtcblx0XHRyZXR1cm4gYWdncmVnYXRlTm9kZTtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyBhbiBhcnJheSBvZiBub2RlIGdyb3VwcyB0aGF0IGFyZSBleHBhbmRlZFxuXHQgKiBAcmV0dXJucyB7QXJyYXl9XG5cdCAqL1xuXHRnZXRVbmdyb3VwZWROb2RlcyA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBpbmZvID0gW107XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdE9iamVjdC5rZXlzKHRoaXMuX3VuZ3JvdXBlZE5vZGVHcm91cHMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG5cdFx0XHR2YXIgbm9kZXMgPSB0aGF0Ll91bmdyb3VwZWROb2RlR3JvdXBzW2tleV07XG5cdFx0XHR2YXIgbm9kZUluZGljZXMgPSBub2Rlcy5tYXAoZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHRyZXR1cm4gbm9kZS5pbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0aW5mby5wdXNoKHtcblx0XHRcdFx0aW5kaWNlcyA6IG5vZGVJbmRpY2VzLFxuXHRcdFx0XHRrZXkgOiBrZXlcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHJldHVybiBpbmZvO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgbGlzdCBvZiB1bmdyb3VwZWQgbm9kZXMgZm9yIGFuIGFnZ3JlZ2F0ZVxuXHQgKiBAcGFyYW0ga2V5IC0ga2V5IHJldHVybmVkIGZyb20gdW5ncm91cFxuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdGdldFVuZ3JvdXBlZE5vZGVzRm9yS2V5IDogZnVuY3Rpb24oa2V5KSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VuZ3JvdXBlZE5vZGVHcm91cHNba2V5XTtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgeCx5IHBvc2l0aW9uIChyZWxhdGl2ZSB0byBncm91cCBib3VuZGluZyBib3gpIGZvciB0aGVcblx0ICogcmVncm91cCAobWluaW1pemUpIGljb25cblx0ICogQHBhcmFtIGJvdW5kaW5nQm94IC0gYm91bmRpbmcgYm94IG9mIG5vZGVzXG5cdCAqIEBwYXJhbSB1bmdyb3VwZWROb2RlcyAtIGNvbGxlY3Rpb24gb2YgdW5ncm91cGVkIG5vZGVzXG5cdCAqIEByZXR1cm5zIHt7eDogKiwgeTogKn19XG5cdCAqL1xuXHRnZXRNaW5pbWl6ZUljb25Qb3NpdGlvbiA6IGZ1bmN0aW9uKGJvdW5kaW5nQm94LHVuZ3JvdXBlZE5vZGVzKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHggOiBib3VuZGluZ0JveC54ICsgYm91bmRpbmdCb3gud2lkdGggKyAxMCxcblx0XHRcdHkgOiBib3VuZGluZ0JveC55XG5cdFx0fTtcblx0fVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBHcm91cGluZ01hbmFnZXI7XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKipcbiAqIExheW91dCBjb25zdHJ1Y3RvclxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBMYXlvdXQgPSBmdW5jdGlvbihhdHRyaWJ1dGVzKSB7XG5cdHRoaXMuX25vZGVzID0gbnVsbDtcblx0dGhpcy5fbGlua01hcCA9IG51bGw7XG5cdHRoaXMuX25vZGVNYXAgPSBudWxsO1xuXHR0aGlzLl9sYWJlbE1hcCA9IG51bGw7XG5cdHRoaXMuX2R1cmF0aW9uID0gMjUwO1xuXHR0aGlzLl9lYXNpbmcgPSAnZWFzZS1pbi1vdXQnO1xuXHR0aGlzLl96b29tU2NhbGUgPSAxLjA7XG5cdHRoaXMuX3NjZW5lID0gbnVsbDtcblx0dGhpcy5fZXZlbnRzU3VzcGVuZGVkID0gZmFsc2U7XG5cdF8uZXh0ZW5kKHRoaXMsYXR0cmlidXRlcyk7XG59O1xuXG5MYXlvdXQucHJvdG90eXBlID0gXy5leHRlbmQoTGF5b3V0LnByb3RvdHlwZSwge1xuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGR1cmF0aW9uIG9mIHRoZSBsYXlvdXQgYW5pbWF0aW9uXG5cdCAqIEBwYXJhbSBkdXJhdGlvbiAtIHRoZSBkdXJhdGlvbiBvZiB0aGUgbGF5b3V0IGFuaW1hdGlvbiBpbiBtaWxsaXNlY29uZHMuICAoZGVmYXVsdCA9IDI1MG1zKVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fSBpZiBkdXJhdGlvbiBwYXJhbSBpcyBkZWZpbmVkLCB7TGF5b3V0Ll9kdXJhdGlvbn0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRkdXJhdGlvbiA6IGZ1bmN0aW9uKGR1cmF0aW9uKSB7XG5cdFx0aWYgKGR1cmF0aW9uKSB7XG5cdFx0XHR0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZHVyYXRpb247XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGVhc2luZyBvZiB0aGUgbGF5b3V0IGFuaW1hdGlvblxuXHQgKiBAcGFyYW0gZWFzaW5nIC0gdGhlIGVhc2luZyBvZiB0aGUgbGF5b3V0IGFuaW1hdGlvbiBpbiBtaWxsaXNlY29uZHMuICAoZGVmYXVsdCA9ICdlYXNlLWluLW91dCcpXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9IGlmIGVhc2luZyBwYXJhbSBpcyBkZWZpbmVkLCB7TGF5b3V0Ll9lYXNpbmd9IG90aGVyd2lzZVxuXHQgKi9cblx0ZWFzaW5nIDogZnVuY3Rpb24oZWFzaW5nKSB7XG5cdFx0aWYgKGVhc2luZykge1xuXHRcdFx0dGhpcy5fZWFzaW5nID0gZWFzaW5nO1xuXHRcdH1cdCBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9lYXNpbmc7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIG5vZGVzIG9mIHRoZSBsYXlvdXQuICAgU2V0IGZyb20gdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSBub2RlcyAtIHRoZSBzZXQgb2Ygbm9kZXMgZGVmaW5lZCBpbiB0aGUgY29ycmVzcG9uZGluZyBncmFwaFxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fSBpZiBub2RlcyBwYXJhbSBpcyBkZWZpbmVkLCB7TGF5b3V0Ll9ub2Rlc30gb3RoZXJ3aXNlXG5cdCAqL1xuXHRub2RlcyA6IGZ1bmN0aW9uKG5vZGVzKSB7XG5cdFx0aWYgKG5vZGVzKSB7XG5cdFx0XHR0aGlzLl9pc1VwZGF0ZSA9IG5vZGVzID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0dGhpcy5fbm9kZXMgPSBub2Rlcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX25vZGVzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBsaW5rIG1hcCBvZiB0aGUgbGF5b3V0LiAgIFNldCBmcm9tIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbGlua01hcCAtIGEgbWFwIGZyb20gbm9kZSBpbmRleCB0byBhIHNldCBvZiBsaW5lcyAocGF0aCBvYmplY3RzKSB0aGF0IGNvbnRhaW4gdGhhdCBub2RlXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9IGlmIGxpbmtNYXAgcGFyYW0gaXMgZGVmaW5lZCwge0xheW91dC5fbGlua01hcH0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRsaW5rTWFwIDogZnVuY3Rpb24obGlua01hcCkge1xuXHRcdGlmIChsaW5rTWFwKSB7XG5cdFx0XHR0aGlzLl9saW5rTWFwID0gbGlua01hcDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xpbmtNYXA7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIG5vZGUgbWFwIG9mIHRoZSBsYXlvdXQuICAgU2V0IGZyb20gdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSBub2RlTWFwIC0gYSBtYXAgZnJvbSBub2RlIGluZGV4IHRvIGEgY2lyY2xlIChwYXRoIG9iamVjdClcblx0ICogQHJldHVybnMge0xheW91dH0gaWYgbm9kZU1hcCBwYXJhbSBpcyBkZWZpbmVkLCB7TGF5b3V0Ll9ub2RlTWFwfSBvdGhlcndpc2Vcblx0ICovXG5cdG5vZGVNYXAgOiBmdW5jdGlvbihub2RlTWFwKSB7XG5cdFx0aWYgKG5vZGVNYXApIHtcblx0XHRcdHRoaXMuX25vZGVNYXAgPSBub2RlTWFwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbm9kZU1hcDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbGFiZWwgb2YgdGhlIGxheW91dC4gICBTZXQgZnJvbSB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIGxhYmVsTWFwIC0gYSBtYXAgZnJvbSBub2RlIGluZGV4IHRvIGEgdGV4dCBvYmplY3QgKHBhdGggb2JqZWN0KVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fSBpZiBsYWJlbE1hcCBwYXJhbSBpcyBkZWZpbmVkLCB7TGF5b3V0Ll9sYWJlbE1hcH0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRsYWJlbE1hcCA6IGZ1bmN0aW9uKGxhYmVsTWFwKSB7XG5cdFx0aWYgKGxhYmVsTWFwKSB7XG5cdFx0XHR0aGlzLl9sYWJlbE1hcCA9IGxhYmVsTWFwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGFiZWxNYXA7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdHNjZW5lIDogZnVuY3Rpb24oc2NlbmUpIHtcblx0XHRpZiAoc2NlbmUpIHtcblx0XHRcdHRoaXMuX3NjZW5lID0gc2NlbmU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9zY2VuZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBib3VuZGluZyBib3ggZm9yIGFuIGFycmF5IG9mIG5vZGUgaW5kaWNlc1xuXHQgKiBAcGFyYW0gbm9kZU9ySW5kZXhBcnJheSAtIGFycmF5IG9mIG5vZGUgaW5kaWNpZXMgb3Igbm9kZSBhcnJheSBpdHNlbGZcblx0ICogQHBhcmFtIHBhZGRpbmcgLSBwYWRkaW5nIGluIHBpeGVscyBhcHBsaWVkIHRvIGJvdW5kaW5nIGJveFxuXHQgKiBAcmV0dXJucyB7e21pbjoge3g6IE51bWJlciwgeTogTnVtYmVyfSwgbWF4OiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9fX1cblx0ICovXG5cdGdldEJvdW5kaW5nQm94IDogZnVuY3Rpb24obm9kZU9ySW5kZXhBcnJheSxwYWRkaW5nLGJJbmNsdWRlTGFiZWxzKSB7XG5cdFx0aWYgKCFub2RlT3JJbmRleEFycmF5IHx8ICFub2RlT3JJbmRleEFycmF5Lmxlbmd0aCB8fCBub2RlT3JJbmRleEFycmF5Lmxlbmd0aCA9PT0gMCB8fCBPYmplY3Qua2V5cyh0aGlzLl9ub2RlTWFwKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHggOiAwLFxuXHRcdFx0XHR5IDogMCxcblx0XHRcdFx0d2lkdGggOiAxLFxuXHRcdFx0XHRoZWlnaHQgOiAxXG5cdFx0XHR9O1xuXHRcdH1cblxuXG5cdFx0dmFyIG1pbiA9IHtcblx0XHRcdHggOiBOdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0eSA6IE51bWJlci5NQVhfVkFMVUVcblx0XHR9O1xuXHRcdHZhciBtYXggPSB7XG5cdFx0XHR4IDogLU51bWJlci5NQVhfVkFMVUUsXG5cdFx0XHR5IDogLU51bWJlci5NQVhfVkFMVUVcblx0XHR9O1xuXG5cdFx0dmFyIGJiUGFkZGluZyA9IHBhZGRpbmcgfHwgMDtcblxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRub2RlT3JJbmRleEFycmF5LmZvckVhY2goZnVuY3Rpb24obm9kZU9ySW5kZXgpIHtcblx0XHRcdHZhciBpZHggPSBub2RlT3JJbmRleCBpbnN0YW5jZW9mIE9iamVjdCA/IG5vZGVPckluZGV4LmluZGV4IDogbm9kZU9ySW5kZXg7XG5cdFx0XHR2YXIgY2lyY2xlID0gdGhhdC5fbm9kZU1hcFtpZHhdO1xuXHRcdFx0bWluLnggPSBNYXRoLm1pbihtaW4ueCwgKGNpcmNsZS5maW5hbFggfHwgY2lyY2xlLngpIC0gKGNpcmNsZS5yYWRpdXMgKyBiYlBhZGRpbmcpKTtcblx0XHRcdG1pbi55ID0gTWF0aC5taW4obWluLnksIChjaXJjbGUuZmluYWxZIHx8IGNpcmNsZS55KSAtIChjaXJjbGUucmFkaXVzICsgYmJQYWRkaW5nKSk7XG5cdFx0XHRtYXgueCA9IE1hdGgubWF4KG1heC54LCAoY2lyY2xlLmZpbmFsWCB8fCBjaXJjbGUueCkgKyAoY2lyY2xlLnJhZGl1cyArIGJiUGFkZGluZykpO1xuXHRcdFx0bWF4LnkgPSBNYXRoLm1heChtYXgueSwgKGNpcmNsZS5maW5hbFkgfHwgY2lyY2xlLnkpICsgKGNpcmNsZS5yYWRpdXMgKyBiYlBhZGRpbmcpKTtcblx0XHR9KTtcblxuXHRcdGlmIChiSW5jbHVkZUxhYmVscykge1xuXHRcdFx0T2JqZWN0LmtleXModGhpcy5fbGFiZWxNYXApLmZvckVhY2goZnVuY3Rpb24obm9kZUluZGV4KSB7XG5cdFx0XHRcdHZhciBsYWJlbCA9IHRoYXQuX2xhYmVsTWFwW25vZGVJbmRleF07XG5cdFx0XHRcdHZhciBtZWFzdXJlbWVudHMgPSB0aGF0Ll9zY2VuZS5tZWFzdXJlKGxhYmVsKTtcblx0XHRcdFx0dmFyIG1pbngsbWlueSxtYXh4LG1heHk7XG5cdFx0XHRcdGlmIChsYWJlbC50ZXh0QWxpZ24gPT09ICdzdGFydCcgfHwgbGFiZWwudGV4dEFsaWduID09PSAnbGVmdCcgfHwgIWxhYmVsLnRleHRBbGlnbikge1xuXHRcdFx0XHRcdG1pbnggPSBsYWJlbC54O1xuXHRcdFx0XHRcdG1heHggPSBtaW54ICsgbWVhc3VyZW1lbnRzLndpZHRoO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGxhYmVsLnRleHRBbGlnbiA9PT0gJ2NlbnRlcicpIHtcblx0XHRcdFx0XHRtaW54ID0gbGFiZWwueCAtIG1lYXN1cmVtZW50cy53aWR0aC8yO1xuXHRcdFx0XHRcdG1heHggPSBsYWJlbC54ICsgbWVhc3VyZW1lbnRzLndpZHRoLzI7XG5cdFx0XHRcdH0gZWxzZSBpZiAobGFiZWwudGV4dEFsaWduID09PSAnZW5kJyB8fCBsYWJlbC50ZXh0QWxpZ24gPT09ICdyaWdodCcpIHtcblx0XHRcdFx0XHRtaW54ID0gbGFiZWwueCAtIG1lYXN1cmVtZW50cy53aWR0aDtcblx0XHRcdFx0XHRtYXh4ID0gbGFiZWwueDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0bWlueSA9IGxhYmVsLnkgLSBtZWFzdXJlbWVudHMuaGVpZ2h0O1xuXHRcdFx0XHRtYXh5ID0gbGFiZWwueTtcblxuXHRcdFx0XHRtaW4ueCA9IE1hdGgubWluKG1pbi54LG1pbngpO1xuXHRcdFx0XHRtaW4ueSA9IE1hdGgubWluKG1pbi55LG1pbnkpO1xuXHRcdFx0XHRtYXgueCA9IE1hdGgubWF4KG1heC54LG1heHgpO1xuXHRcdFx0XHRtYXgueSA9IE1hdGgubWF4KG1heC55LG1heHkpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHR4IDogbWluLngsXG5cdFx0XHR5IDogbWluLnksXG5cdFx0XHR3aWR0aCA6IChtYXgueCAtIG1pbi54KSxcblx0XHRcdGhlaWdodCA6IChtYXgueSAtIG1pbi55KVxuXHRcdH07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgd2hldGhlcmUgd2Ugc2hvdWxkIGFwcGx5IHpvb20gd2hlbiBwZXJmb3JtaW5nIGEgbGF5b3V0LiAgIFNob3VsZCBuZXZlciBiZVxuXHQgKiBjYWxsZWQgYnkgdXNlclxuXHQgKiBAcGFyYW0gYkFwcGx5XG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfYXBwbHlab29tU2NhbGUgOiBmdW5jdGlvbihiQXBwbHkpIHtcblx0XHR0aGlzLl9hcHBseVpvb20gPSBiQXBwbHk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHBvc2l0aW9uIG9mIGEgbm9kZSBhbmQgYWxsIGF0dGFjaGVkIGxpbmtzIGFuZCBsYWJlbHMgd2l0aG91dCBhbmltYXRpb25cblx0ICogQHBhcmFtIG5vZGUgLSB0aGUgbm9kZSBvYmplY3QgYmVpbmcgcG9zaXRpb25lZFxuXHQgKiBAcGFyYW0geCAtIHRoZSBuZXcgeCBwb3NpdGlvbiBmb3IgdGhlIG5vZGVcblx0ICogQHBhcmFtIHkgLSB0aGUgbmV3IHkgcG9zaXRpb24gZm9yIHRoZSBub2RlXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfc2V0Tm9kZVBvc2l0aW9uSW1tZWRpYXRlIDogZnVuY3Rpb24obm9kZSx4LHksY2FsbGJhY2spIHtcblx0XHR0aGlzLl9zZXROb2RlUG9zaXRpb24obm9kZSx4LHksdHJ1ZSk7XG5cdFx0aWYgKGNhbGxiYWNrKSB7XG5cdFx0XHRjYWxsYmFjaygpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgcG9zaXRpb24gb2YgYSBub2RlIGJ5IGFuaW1hdGluZyBmcm9tIGl0J3Mgb2xkIHBvc2l0aW9uIHRvIGl0J3MgbmV3IG9uZVxuXHQgKiBAcGFyYW0gbm9kZSAtIHRoZSBub2RlIGJlaW5nIHJlcG9zaXRpb25lZFxuXHQgKiBAcGFyYW0geCAtIHRoZSBuZXcgeCBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0geSAtIHRoZSBuZXcgeSBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gYkltbWVkaWF0ZSAtIGlmIHRydWUsIHNldHMgd2l0aG91dCBhbmltYXRpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfc2V0Tm9kZVBvc2l0aW9uIDogZnVuY3Rpb24obm9kZSxuZXdYLG5ld1ksYkltbWVkaWF0ZSxjYWxsYmFjaykge1xuXHRcdHZhciB4ID0gbmV3WCAqICh0aGlzLl9hcHBseVpvb20gPyB0aGlzLl96b29tU2NhbGUgOiAxKTtcblx0XHR2YXIgeSA9IG5ld1kgKiAodGhpcy5fYXBwbHlab29tID8gdGhpcy5fem9vbVNjYWxlIDogMSk7XG5cblxuXHRcdC8vIFVwZGF0ZSB0aGUgbm9kZSByZW5kZXIgb2JqZWN0XG5cdFx0dmFyIGNpcmNsZSA9IHRoaXMuX25vZGVNYXBbbm9kZS5pbmRleF07XG5cdFx0aWYgKGJJbW1lZGlhdGUhPT10cnVlKSB7XG5cdFx0XHRjaXJjbGUudHdlZW5BdHRyKHtcblx0XHRcdFx0eDogeCxcblx0XHRcdFx0eTogeVxuXHRcdFx0fSwge1xuXHRcdFx0XHRkdXJhdGlvbjogdGhpcy5fZHVyYXRpb24sXG5cdFx0XHRcdGVhc2luZzogdGhpcy5fZWFzaW5nLFxuXHRcdFx0XHRjYWxsYmFjayA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGRlbGV0ZSBjaXJjbGUuZmluYWxYO1xuXHRcdFx0XHRcdGRlbGV0ZSBjaXJjbGUuZmluYWxZO1xuXHRcdFx0XHRcdG5vZGUueCA9IHg7XG5cdFx0XHRcdFx0bm9kZS55ID0geTtcblx0XHRcdFx0XHRpZiAoY2FsbGJhY2spIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGNpcmNsZS5maW5hbFggPSB4O1xuXHRcdFx0Y2lyY2xlLmZpbmFsWSA9IHk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNpcmNsZS54ID0geDtcblx0XHRcdGNpcmNsZS55ID0geTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2xpbmtNYXBbbm9kZS5pbmRleF0ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRub2RlLnggPSB4O1xuXHRcdFx0bm9kZS55ID0geTtcblx0XHRcdGNpcmNsZS54ID0geDtcblx0XHRcdGNpcmNsZS55ID0geTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgdGhlIGxhYmVsIHJlbmRlciBvYmplY3Rcblx0XHR2YXIgbGFiZWwgPSB0aGlzLl9sYWJlbE1hcFtub2RlLmluZGV4XTtcblx0XHRpZiAobGFiZWwpIHtcblx0XHRcdHZhciBsYWJlbFBvcyA9IHRoaXMubGF5b3V0TGFiZWwoY2lyY2xlKTtcblx0XHRcdGlmIChiSW1tZWRpYXRlIT09dHJ1ZSkge1xuXHRcdFx0XHRsYWJlbC50d2VlbkF0dHIobGFiZWxQb3MsIHtcblx0XHRcdFx0XHRkdXJhdGlvbjogdGhpcy5fZHVyYXRpb24sXG5cdFx0XHRcdFx0ZWFzaW5nOiB0aGlzLl9lYXNpbmdcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmb3IgKHZhciBwcm9wIGluIGxhYmVsUG9zKSB7XG5cdFx0XHRcdFx0aWYgKGxhYmVsUG9zLmhhc093blByb3BlcnR5KHByb3ApKSB7XG5cdFx0XHRcdFx0XHRsYWJlbFtwcm9wXSA9IGxhYmVsUG9zW3Byb3BdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXG5cdFx0Ly8gVXBkYXRlIHRoZSBsaW5rIHJlbmRlciBvYmplY3Rcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0dGhpcy5fbGlua01hcFtub2RlLmluZGV4XS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmspIHtcblx0XHRcdHZhciBsaW5rT2JqS2V5ID0gbnVsbDtcblx0XHRcdGlmIChsaW5rLnNvdXJjZS5pbmRleCA9PT0gbm9kZS5pbmRleCkge1xuXHRcdFx0XHRsaW5rT2JqS2V5ID0gJ3NvdXJjZSc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsaW5rT2JqS2V5ID0gJ3RhcmdldCc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYkltbWVkaWF0ZSE9PXRydWUpIHtcblx0XHRcdFx0bGluay50d2Vlbk9iaihsaW5rT2JqS2V5LCB7XG5cdFx0XHRcdFx0eDogeCxcblx0XHRcdFx0XHR5OiB5XG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRkdXJhdGlvbjogdGhhdC5fZHVyYXRpb24sXG5cdFx0XHRcdFx0ZWFzaW5nOiB0aGF0Ll9lYXNpbmdcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsaW5rW2xpbmtPYmpLZXldLnggPSB4O1xuXHRcdFx0XHRsaW5rW2xpbmtPYmpLZXldLnkgPSB5O1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBMYXlvdXQgaGFuZGxlci4gICBDYWxscyBpbXBsZW1lbnRpbmcgbGF5b3V0IHJvdXRpbmUgYW5kIHByb3ZpZGVzIGEgY2FsbGJhY2sgaWYgaXQncyBhc3luY1xuXHQgKiBAcGFyYW0gdyAtIHRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIGJlaW5nIHJlbmRlcmVkIHRvXG5cdCAqIEBwYXJhbSBoIC0gdGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIGJlaW5nIHJlbmRlcmVkIHRvXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9XG5cdCAqL1xuXHRsYXlvdXQgOiBmdW5jdGlvbih3LGgsY2FsbGJhY2spIHtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0ZnVuY3Rpb24gb25Db21wbGV0ZSgpIHtcblx0XHRcdHRoYXQuX2V2ZW50c1N1c3BlbmRlZCA9IGZhbHNlO1xuXHRcdFx0aWYgKGNhbGxiYWNrKSB7XG5cdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fZXZlbnRzU3VzcGVuZGVkID0gdHJ1ZTtcblx0XHR2YXIgaXNBc3luYyA9ICF0aGlzLl9wZXJmb3JtTGF5b3V0KHcsaCk7XG5cdFx0aWYgKGlzQXN5bmMpIHtcblx0XHRcdHNldFRpbWVvdXQob25Db21wbGV0ZSx0aGlzLmR1cmF0aW9uKCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvbkNvbXBsZXRlKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBEZWZhdWx0IGxheW91dCB0aGF0IGRvZXMgbm90aGluZy4gICBTaG91bGQgYmUgb3ZlcnJpZGVuXG5cdCAqIEBwYXJhbSB3XG5cdCAqIEBwYXJhbSBoXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfcGVyZm9ybUxheW91dCA6IGZ1bmN0aW9uKHcsaCkge1xuXG5cdH0sXG5cblxuXHQvKipcblx0ICogXHQvKipcblx0ICogSG9vayBmb3IgZG9pbmcgYW55IGRyYXdpbmcgYmVmb3JlIHJlbmRlcmluZyBvZiB0aGUgZ3JhcGggdGhhdCBpcyBsYXlvdXQgc3BlY2lmaWNcblx0ICogaWUvIEJhY2tncm91bmRzLCBldGNcblx0ICogQHBhcmFtIHcgLSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhc1xuXHQgKiBAcGFyYW0gaCAtIHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhc1xuXHQgKiBAcmV0dXJucyB7QXJyYXl9IC0gYSBsaXN0IG9mIHBhdGguanMgcmVuZGVyIG9iamVjdHMgdG8gYmUgYWRkZWQgdG8gdGhlIHNjZW5lXG5cdCAqL1xuXHRwcmVyZW5kZXIgOiBmdW5jdGlvbih3LGgpIHtcblx0XHRyZXR1cm4gW107XG5cdH0sXG5cblx0LyoqXG5cdCAqIEhvb2sgZm9yIGRvaW5nIGFueSBkcmF3aW5nIGFmdGVyIHJlbmRlcmluZyBvZiB0aGUgZ3JhcGggdGhhdCBpcyBsYXlvdXQgc3BlY2lmaWNcblx0ICogaWUvIE92ZXJsYXlzLCBldGNcblx0ICogQHBhcmFtIHcgLSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhc1xuXHQgKiBAcGFyYW0gaCAtIHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhc1xuXHQgKiBAcmV0dXJucyB7QXJyYXl9IC0gYSBsaXN0IG9mIHBhdGguanMgcmVuZGVyIG9iamVjdHMgdG8gYmUgYWRkZWQgdG8gdGhlIHNjZW5lXG5cdCAqL1xuXHRwb3N0cmVuZGVyIDogZnVuY3Rpb24odyxoKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsYmFjayBmb3IgdXBkYXRpbmcgcG9zdCByZW5kZXIgb2JqZWN0cy4gICBVc3VhbGx5IHJlbmRlcmVkIGluIHNjcmVlbnNwYWNlXG5cdCAqIEBwYXJhbSBtaW54IC0gbWluIHggY29vcmRpbmF0ZSBvZiBzY3JlZW5cblx0ICogQHBhcmFtIG1pbnkgLSBtaW4geSBjb29yZGluYXRlIG9mIHNjcmVlblxuXHQgKiBAcGFyYW0gbWF4eCAtIG1heCB4IGNvb3JkaW5hdGUgb2Ygc2NyZWVuXG5cdCAqIEBwYXJhbSBtYXh5IC0gbWF4IHkgY29vcmRpbmF0ZSBvZiBzY3JlZW5cblx0ICovXG5cdHBvc3RyZW5kZXJVcGRhdGUgOiBmdW5jdGlvbihtaW54LG1pbnksbWF4eCxtYXh5KSB7XG5cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgbGFiZWwgcG9zaXRpb24gZm9yIGEgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVggLSB0aGUgeCBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVkgLSB0aGUgeSBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gcmFkaXVzIC0gdGhlIHJhZGl1cyBvZiB0aGUgbm9kZVxuXHQgKiBAcmV0dXJucyB7e3g6IHggcG9zaXRpb24gb2YgdGhlIGxhYmVsLCB5OiB5IHBvc2l0aW9uIG9mIHRoZSBsYWJlbH19XG5cdCAqL1xuXHRsYXlvdXRMYWJlbCA6IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0eDogbm9kZS54ICsgbm9kZS5yYWRpdXMgKyA1LFxuXHRcdFx0eTogbm9kZS55ICsgbm9kZS5yYWRpdXMgKyA1XG5cdFx0fTtcblx0fVxufSk7XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IExheW91dDtcbiIsInZhciBMSU5LX1RZUEUgPSB7XG5cdERFRkFVTFQgOiAnbGluZScsXG5cdExJTkUgOiAnbGluZScsXG5cdEFSUk9XIDogJ2Fycm93Jyxcblx0QVJDIDogJ2FyYydcbn07XG5tb2R1bGUuZXhwb3J0cyA9IExJTktfVFlQRTsiLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIExJTktfVFlQRSA9IHJlcXVpcmUoJy4vbGlua1R5cGUnKTtcbnZhciBMYXlvdXQgPSByZXF1aXJlKCcuL2xheW91dCcpO1xuXG52YXIgUkVHUk9VTkRfQkJfUEFERElORyA9IDA7XG5cbi8qKlxuICogQ3JlYXRlcyBhIEdyYXBoIHJlbmRlciBvYmplY3RcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgR3JhcGggPSBmdW5jdGlvbihhdHRyaWJ1dGVzKSB7XG5cdHRoaXMuX25vZGVzID0gW107XG5cdHRoaXMuX2xpbmtzID0gW107XG5cdHRoaXMuX2NhbnZhcyA9IG51bGw7XG5cdHRoaXMuX2xheW91dGVyID0gbnVsbDtcblx0dGhpcy5fZ3JvdXBpbmdNYW5hZ2VyID0gbnVsbDtcblx0dGhpcy5fd2lkdGggPSAwO1xuXHR0aGlzLl9oZWlnaHQgPSAwO1xuXHR0aGlzLl96b29tU2NhbGUgPSAxLjA7XG5cdHRoaXMuX3pvb21MZXZlbCA9IDA7XG5cdHRoaXMuX3NjZW5lID0gbnVsbDtcblx0dGhpcy5fc2hvd0FsbExhYmVscyA9IGZhbHNlO1xuXHR0aGlzLl9wcmVyZW5kZXJHcm91cCA9IG51bGw7XG5cdHRoaXMuX3Bvc3RyZW5kZXJHcm91cCA9IG51bGw7XG5cdHRoaXMuX3Bhbm5hYmxlID0gbnVsbDtcblx0dGhpcy5fem9vbWFibGUgPSBudWxsO1xuXHR0aGlzLl9kcmFnZ2FibGUgPSBudWxsO1xuXHR0aGlzLl9jdXJyZW50T3Zlck5vZGUgPSBudWxsO1xuXHR0aGlzLl9jdXJyZW50TW92ZVN0YXRlID0gbnVsbDtcblx0dGhpcy5faW52ZXJ0ZWRQYW4gPSAxO1xuXG5cdHRoaXMuX2ZvbnRTaXplID0gbnVsbDtcblx0dGhpcy5fZm9udEZhbWlseSA9IG51bGw7XG5cdHRoaXMuX2ZvbnRDb2xvciA9IG51bGw7XG5cdHRoaXMuX2ZvbnRTdHJva2UgPSBudWxsO1xuXHR0aGlzLl9mb250U3Ryb2tlV2lkdGggPSBudWxsO1xuXHR0aGlzLl9zaGFkb3dDb2xvciA9IG51bGw7XG5cdHRoaXMuX3NoYWRvd09mZnNldFggPSBudWxsO1xuXHR0aGlzLl9zaGFkb3dPZmZzZXRZID0gbnVsbDtcblx0dGhpcy5fc2hhZG93Qmx1ciA9IG51bGw7XG5cblx0Ly8gRGF0YSB0byByZW5kZXIgb2JqZWN0IG1hcHNcblx0dGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSA9IHt9O1xuXHR0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZSA9IHt9O1xuXHR0aGlzLl9ub2RlSW5kZXhUb0xhYmVsID0ge307XG5cblx0Xy5leHRlbmQodGhpcyxhdHRyaWJ1dGVzKTtcbn07XG5cbkdyYXBoLnByb3RvdHlwZSA9IF8uZXh0ZW5kKEdyYXBoLnByb3RvdHlwZSwge1xuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBub2RlcyBmb3IgdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSBub2RlcyAtIGFuIGFycmF5IG9mIG5vZGVzXG5cdCAqIHtcblx0ICogXHRcdHggOiB0aGUgeCBjb29yZGluYXRlIG9mIHRoZSBub2RlXHQocmVxdWlyZWQpXG5cdCAqIFx0XHR5IDogdGhlIHkgY29vcmRpbmF0ZSBvZiB0aGUgbm9kZVx0KHJlcXVpcmVkKVxuXHQgKlx0XHRpbmRleCA6ICBhIHVuaXF1ZSBpbmRleFx0XHRcdFx0KHJlcXVpcmVkKVxuXHQgKlx0XHRsYWJlbCA6IGEgbGFiZWwgZm9yIHRoZSBub2RlXHRcdChvcHRpb25hbClcblx0ICpcdFx0ZmlsbFN0eWxlIDogYSBjYW52YXMgZmlsbCAgIFx0XHQob3B0aW9uYWwsIGRlZmF1bHQgIzAwMDAwMClcblx0ICpcdFx0c3Ryb2tlU3R5bGUgOiBhIGNhbnZhcyBzdHJva2VcdFx0KG9wdGlvbmFsLCBkZWZhdWx0IHVuZGVmaW5lZClcblx0ICpcdFx0bGluZVdpZHRoIDogd2lkdGggb2YgdGhlIHN0cm9rZVx0XHQob3B0aW9uYWwsIGRlZmF1bHQgMSlcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBub2RlcyBwYXJhbWV0ZXIgaXMgZGVmaW5lZCwge0dyYXBoLl9ub2Rlc30gb3RoZXJ3aXNlXG5cdCAqL1xuXHRub2RlcyA6IGZ1bmN0aW9uKG5vZGVzKSB7XG5cdFx0aWYgKG5vZGVzKSB7XG5cdFx0XHR0aGlzLl9ub2RlcyA9IG5vZGVzO1xuXG5cdFx0XHR0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lID0ge307XG5cdFx0XHR0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZSA9IHt9O1xuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9MYWJlbCA9IHt9O1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0bm9kZXMuZm9yRWFjaChmdW5jdGlvbihub2RlKSB7XG5cdFx0XHRcdHRoYXQuX25vZGVJbmRleFRvTGlua0xpbmVbbm9kZS5pbmRleF0gPSBbXTt9KTtcblx0XHRcdGlmICh0aGlzLl9sYXlvdXRlcikge1xuXHRcdFx0XHR0aGlzLl9sYXlvdXRlci5ub2Rlcyhub2Rlcyk7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX25vZGVzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0IG5vZGUgcmVuZGVyIG9iamVjdFxuXHQgKiBAcGFyYW0gbm9kZUluZGV4IC0gaW5kZXggb2YgdGhlIG5vZGVcblx0ICogQHJldHVybnMgcGF0aGpzIGNpcmNsZSBvYmplY3Rcblx0ICovXG5cdG5vZGVXaXRoSW5kZXggOiBmdW5jdGlvbihub2RlSW5kZXgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbm9kZUluZGV4VG9DaXJjbGVbbm9kZUluZGV4XTtcblx0fSxcblxuXHQvKipcblx0ICogR2V0IGxhYmVsIHJlbmRlciBvYmplY3QgZm9yIGEgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZUluZGV4IC0gaW5kZXggb2YgdGhlIG5vZGVcblx0ICogQHJldHVybnMgcGF0aGpzIHJlbmRlciBvYmplY3Rcblx0ICovXG5cdGxhYmVsV2l0aEluZGV4IDogZnVuY3Rpb24obm9kZUluZGV4KSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZUluZGV4XTtcblx0fSxcblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSByZW5kZXIgcHJvcGVydGllcyBvZiBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVJbmRleCAtIGluZGV4IG9mIHRoZSBub2RlXG5cdCAqIEBwYXJhbSBwcm9wcyAtIGFueSBwYXRoanMgcHJvcGVydGllcyB3ZSB3aXNoIHRvIHVwZGF0ZVxuXHQgKi9cblx0dXBkYXRlTm9kZSA6IGZ1bmN0aW9uKG5vZGVJbmRleCxwcm9wcykge1xuXHRcdC8vIFRPRE86ICByZW1vdmUgbXVja2luZyB3aXRoIHBvc2l0aW9uIHNldHRpbmdzIGZyb20gcHJvcHM/XG5cdFx0aWYgKG5vZGVJbmRleCkge1xuXHRcdFx0dmFyIGNpcmNsZSA9IHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlW25vZGVJbmRleF07XG5cdFx0XHRjaXJjbGUgPSBfLmV4dGVuZChjaXJjbGUscHJvcHMpO1xuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9DaXJjbGVbbm9kZUluZGV4XSA9IGNpcmNsZTtcblx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBVcGRhdGUgdGhlIHJlbmRlciBwcm9wZXJ0aWVzIG9mIGEgbGFiZWxcblx0ICogQHBhcmFtIG5vZGVJbmRleCAtIGluZGV4IG9mIHRoZSBub2RlIHRoaXMgbGFiZWwgaXMgYXR0YWNoZWQgdG9cblx0ICogQHBhcmFtIHByb3BzIC0gYW55IHBhdGhqcyBwcm9wZXJ0aWVycyB3ZSB3aXRoIHRvIHVwZGF0ZVxuXHQgKi9cblx0dXBkYXRlTGFiZWwgOiBmdW5jdGlvbihub2RlSW5kZXgscHJvcHMpIHtcblx0XHQvLyBUT0RPOiAgcmVtb3ZlIG11Y2tpbmcgd2l0aCBwb3NpdGlvbiBzZXR0aW5ncyBmcm9tIHByb3BzP1xuXHRcdGlmIChub2RlSW5kZXgpIHtcblx0XHRcdHZhciB0ZXh0ID0gdGhpcy5fbm9kZUluZGV4VG9MYWJlbFtub2RlSW5kZXhdO1xuXHRcdFx0dGV4dCA9IF8uZXh0ZW5kKHRleHQscHJvcHMpO1xuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9MYWJlbFtub2RlSW5kZXhdID0gdGV4dDtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBub2RlcyBmb3IgdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSBsaW5rcyAtIGFuIGFycmF5IG9mIGxpbmtzXG5cdCAqIHtcblx0ICogXHRcdHNvdXJjZSA6IGEgbm9kZSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGUgc291cmNlIFx0KHJlcXVpcmVkKVxuXHQgKiBcdFx0dGFyZ2V0IDogYSBub2RlIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoZSB0YXJnZXRcdChyZXF1aXJlZClcblx0ICpcdFx0c3Ryb2tlU3R5bGUgOiBhIGNhbnZhcyBzdHJva2VcdFx0XHRcdFx0XHQob3B0aW9uYWwsIGRlZmF1bHQgIzAwMDAwMClcblx0ICpcdFx0bGluZVdpZHRoIDogdGhlIHdpZHRoIG9mIHRoZSBzdHJva2VcdFx0XHRcdFx0KG9wdGluYWwsIGRlZmF1bHQgMSlcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBsaW5rcyBwYXJhbWV0ZXIgaXMgZGVmaW5lZCwge0dyYXBoLl9saW5rc30gb3RoZXJ3aXNlXG5cdCAqL1xuXHRsaW5rcyA6IGZ1bmN0aW9uKGxpbmtzKSB7XG5cdFx0aWYgKGxpbmtzKSB7XG5cdFx0XHR0aGlzLl9saW5rcyA9IGxpbmtzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGlua3M7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBsaW5rcyBiZXR3ZWVuIHR3byBub2Rlc1xuXHQgKiBAcGFyYW0gc291cmNlTm9kZUluZGV4IC0gSW5kZXggb2Ygc291cmNlIG5vZGUsIGlmIG51bGwsIHJldHVybiBhbGwgbGlua3MgZ29pbmcgdG8gdGFyZ2V0XG5cdCAqIEBwYXJhbSB0YXJnZXROb2RlSW5kZXggLSBJbmRleCBvZiB0YXJnZXQgbm9kZSwgaWYgbnVsbCwgcmV0dXJuIGFsbCBsaW5rcyBzdGFydGluZyBmcm9tIHNvdXJjZVxuXHQgKi9cblx0bGlua09iamVjdHNCZXR3ZWVuIDogZnVuY3Rpb24oc291cmNlTm9kZUluZGV4LHRhcmdldE5vZGVJbmRleCkge1xuXHRcdGZ1bmN0aW9uIGlzUHJvdmlkZWQocGFyYW0pIHtcblx0XHRcdGlmIChwYXJhbSA9PT0gdW5kZWZpbmVkIHx8IHBhcmFtID09PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpc1Byb3ZpZGVkKHNvdXJjZU5vZGVJbmRleCkgJiYgIWlzUHJvdmlkZWQodGFyZ2V0Tm9kZUluZGV4KSkge1xuXHRcdFx0dmFyIGFsbFNvdXJjZSA9IHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmVbc291cmNlTm9kZUluZGV4XTtcblx0XHRcdHZhciBqdXN0U291cmNlID0gYWxsU291cmNlLmZpbHRlcihmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHRcdHJldHVybiBsaW5rLnNvdXJjZS5pbmRleCA9PT0gc291cmNlTm9kZUluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4ganVzdFNvdXJjZTtcblx0XHR9IGVsc2UgaWYgKCFpc1Byb3ZpZGVkKHNvdXJjZU5vZGVJbmRleCkgJiYgaXNQcm92aWRlZCh0YXJnZXROb2RlSW5kZXgpKSB7XG5cdFx0XHR2YXIgYWxsVGFyZ2V0ID0gdGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZVt0YXJnZXROb2RlSW5kZXhdO1xuXHRcdFx0dmFyIGp1c3RUYXJnZXQgPSBhbGxUYXJnZXQuZmlsdGVyKGZ1bmN0aW9uKGxpbmspIHtcblx0XHRcdFx0cmV0dXJuIGxpbmsudGFyZ2V0LmluZGV4ID09PSB0YXJnZXROb2RlSW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBqdXN0VGFyZ2V0O1xuXHRcdH0gZWxzZSBpZiAoaXNQcm92aWRlZChzb3VyY2VOb2RlSW5kZXgpICYmIGlzUHJvdmlkZWQodGFyZ2V0Tm9kZUluZGV4KSkge1xuXHRcdFx0dmFyIHNvdXJjZUxpbmtzID0gdGhpcy5saW5rT2JqZWN0c0JldHdlZW4oc291cmNlTm9kZUluZGV4LG51bGwpO1xuXHRcdFx0dmFyIHRvVGFyZ2V0ID0gc291cmNlTGlua3MuZmlsdGVyKGZ1bmN0aW9uKGxpbmspIHtcblx0XHRcdFx0cmV0dXJuIGxpbmsudGFyZ2V0LmluZGV4ID09PSB0YXJnZXROb2RlSW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0b1RhcmdldDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBjYW52YXMgZm9yIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gY2FudmFzIC0gYW4gSFRNTCBjYW52YXMgb2JqZWN0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgY2FudmFzIHBhcmFtZXRlciBpcyBkZWZpbmVkLCB0aGUgY2FudmFzIG90aGVyd2lzZVxuXHQgKi9cblx0Y2FudmFzIDogZnVuY3Rpb24oY2FudmFzKSB7XG5cdFx0aWYgKGNhbnZhcykge1xuXHRcdFx0dGhpcy5fY2FudmFzID0gY2FudmFzO1xuXG5cdFx0XHR2YXIgeCx5O1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCh0aGlzLl9jYW52YXMpLm9uKCdtb3VzZWRvd24nLGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0eCA9IGUuY2xpZW50WDtcblx0XHRcdFx0eSA9IGUuY2xpZW50WTtcblx0XHRcdFx0JCh0aGF0Ll9jYW52YXMpLm9uKCdtb3VzZW1vdmUnLGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHR2YXIgZHggPSB4IC0gZS5jbGllbnRYO1xuXHRcdFx0XHRcdHZhciBkeSA9IHkgLSBlLmNsaWVudFk7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2RyYWdnYWJsZSAmJiB0aGF0Ll9jdXJyZW50T3Zlck5vZGUgJiYgKHRoYXQuX2N1cnJlbnRNb3ZlU3RhdGUgPT09IG51bGwgfHwgdGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9PT0gJ2RyYWdnaW5nJykpICB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID0gJ2RyYWdnaW5nJztcblxuXHRcdFx0XHRcdFx0Ly8gTW92ZSB0aGUgbm9kZVxuXHRcdFx0XHRcdFx0dGhhdC5fbGF5b3V0ZXIuX3NldE5vZGVQb3NpdGlvbkltbWVkaWF0ZSh0aGF0Ll9jdXJyZW50T3Zlck5vZGUsIHRoYXQuX2N1cnJlbnRPdmVyTm9kZS54IC0gZHgsIHRoYXQuX2N1cnJlbnRPdmVyTm9kZS55IC0gZHkpO1xuXHRcdFx0XHRcdFx0dGhhdC51cGRhdGUoKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHRoYXQuX3Bhbm5hYmxlICYmICh0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID09PSBudWxsIHx8IHRoYXQuX2N1cnJlbnRNb3ZlU3RhdGUgPT09ICdwYW5uaW5nJykpIHtcblx0XHRcdFx0XHRcdHRoYXQuX3BhbigtZHgqdGhhdC5faW52ZXJ0ZWRQYW4sLWR5KnRoYXQuX2ludmVydGVkUGFuKTtcblx0XHRcdFx0XHRcdHRoYXQuX2N1cnJlbnRNb3ZlU3RhdGUgPSAncGFubmluZyc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHggPSBlLmNsaWVudFg7XG5cdFx0XHRcdFx0eSA9IGUuY2xpZW50WTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0JCh0aGlzLl9jYW52YXMpLm9uKCdtb3VzZXVwJyxmdW5jdGlvbigpIHtcblx0XHRcdFx0JCh0aGF0Ll9jYW52YXMpLm9mZignbW91c2Vtb3ZlJyk7XG5cdFx0XHRcdGlmICh0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID09PSAnZHJhZ2dpbmcnKSB7XG5cdFx0XHRcdFx0dGhhdC5fY3VycmVudE92ZXJOb2RlID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID0gbnVsbDtcblx0XHRcdH0pO1xuXG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NhbnZhcztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCB3aWR0aFxuXHQgKiBAcmV0dXJucyBXaWR0aCBpbiBwaXhlbHMgb2YgdGhlIGdyYXBoXG5cdCAqL1xuXHR3aWR0aCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9zY2VuZS53aWR0aDtcblx0fSxcblxuXHQvKipcblx0ICogR2V0IGhlaWdodFxuXHQgKiBAcmV0dXJucyBIZWlnaHQgaW4gcGl4ZWxzIG9mIHRoZSBncmFwaFxuXHQgKi9cblx0aGVpZ2h0IDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NjZW5lLmhlaWdodDtcblx0fSxcblxuXHQvKipcblx0ICogVG9nZ2xlcyBib29sZWFuIGZvciBzaG93aW5nL2hpZGluZyBhbGwgbGFiZWxzIGluIHRoZSBncmFwaCBieSBkZWZhdWx0XG5cdCAqIEBwYXJhbSBzaG93QWxsTGFiZWxzXG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0c2hvd0FsbExhYmVscyA6IGZ1bmN0aW9uKHNob3dBbGxMYWJlbHMpIHtcblx0XHRpZiAoc2hvd0FsbExhYmVscyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9zaG93QWxsTGFiZWxzID0gc2hvd0FsbExhYmVscztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3Nob3dBbGxMYWJlbHM7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlXG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX25vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0aWYgKHNob3dBbGxMYWJlbHMpIHtcblx0XHRcdFx0dGhhdC5hZGRMYWJlbChub2RlLG5vZGUubGFiZWxUZXh0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoYXQucmVtb3ZlTGFiZWwobm9kZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBhIGxhYmVsIGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVcblx0ICogQHBhcmFtIHRleHRcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0YWRkTGFiZWwgOiBmdW5jdGlvbihub2RlLHRleHQpIHtcblx0XHRpZiAodGhpcy5fbm9kZUluZGV4VG9MYWJlbFtub2RlLmluZGV4XSkge1xuXHRcdFx0dGhpcy5yZW1vdmVMYWJlbChub2RlKTtcblx0XHR9XG5cdFx0dmFyIGxhYmVsQXR0cnMgPSB0aGlzLl9sYXlvdXRlci5sYXlvdXRMYWJlbChub2RlKTtcblxuXHRcdHZhciBmb250U2l6ZSA9IHR5cGVvZih0aGlzLl9mb250U2l6ZSkgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9mb250U2l6ZShub2RlKSA6IHRoaXMuX2ZvbnRTaXplO1xuXHRcdGlmICghZm9udFNpemUpIHtcblx0XHRcdGZvbnRTaXplID0gMTA7XG5cdFx0fVxuXG5cdFx0dmFyIGZvbnRGYW1pbHkgPSB0eXBlb2YodGhpcy5fZm9udEZhbWlseSkgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9mb250RmFtaWx5KG5vZGUpIDogdGhpcy5fZm9udEZhbWlseTtcblx0XHRpZiAoIWZvbnRGYW1pbHkpIHtcblx0XHRcdGZvbnRGYW1pbHkgPSAnc2Fucy1zZXJpZic7XG5cdFx0fVxuXHRcdHZhciBmb250U3RyID0gZm9udFNpemUgKyAncHggJyArIGZvbnRGYW1pbHk7XG5cblx0XHR2YXIgZm9udEZpbGwgPSB0eXBlb2YodGhpcy5fZm9udENvbG9yKSA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX2ZvbnRDb2xvcihub2RlKSA6IHRoaXMuX2ZvbnRDb2xvcjtcblx0XHRpZiAoIWZvbnRGaWxsKSB7XG5cdFx0XHRmb250RmlsbCA9ICcjMDAwMDAwJztcblx0XHR9XG5cdFx0dmFyIGZvbnRTdHJva2UgPSB0eXBlb2YodGhpcy5fZm9udFN0cm9rZSkgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9mb250U3Ryb2tlKG5vZGUpIDogdGhpcy5fZm9udFN0cm9rZTtcblx0XHR2YXIgZm9udFN0cm9rZVdpZHRoID0gdHlwZW9mKHRoaXMuX2ZvbnRTdHJva2UpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udFN0cm9rZVdpZHRoIDogdGhpcy5fZm9udFN0cm9rZVdpZHRoO1xuXG5cdFx0dmFyIGxhYmVsU3BlYyA9IHtcblx0XHRcdGZvbnQ6IGZvbnRTdHIsXG5cdFx0XHRmaWxsU3R5bGU6IGZvbnRGaWxsLFxuXHRcdFx0c3Ryb2tlU3R5bGU6IGZvbnRTdHJva2UsXG5cdFx0XHRsaW5lV2lkdGg6IGZvbnRTdHJva2VXaWR0aCxcblx0XHRcdHRleHQgOiB0ZXh0XG5cdFx0fTtcblxuXHRcdHZhciBiQWRkU2hhZG93ID0gdGhpcy5fc2hhZG93Qmx1ciB8fCB0aGlzLl9zaGFkb3dPZmZzZXRYIHx8IHRoaXMuX3NoYWRvd09mZnNldFkgfHwgdGhpcy5fc2hhZG93Q29sb3I7XG5cdFx0aWYgKGJBZGRTaGFkb3cpIHtcblx0XHRcdGxhYmVsU3BlY1snc2hhZG93Q29sb3InXSA9IHRoaXMuX3NoYWRvd0NvbG9yIHx8ICcjMDAwJztcblx0XHRcdGxhYmVsU3BlY1snc2hhZG93T2Zmc2V0WCddID0gdGhpcy5fc2hhZG93T2Zmc2V0WCB8fCAwO1xuXHRcdFx0bGFiZWxTcGVjWydzaGFkb3dPZmZzZXRZJ10gPSB0aGlzLl9zaGFkb3dPZmZzZXRZIHx8IDA7XG5cdFx0XHRsYWJlbFNwZWNbJ3NoYWRvd0JsdXInXSA9IHRoaXMuX3NoYWRvd0JsdXIgfHwgTWF0aC5mbG9vcihmb250U2l6ZS8zKTtcblx0XHR9XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gbGFiZWxBdHRycykge1xuXHRcdFx0aWYgKGxhYmVsQXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRsYWJlbFNwZWNba2V5XSA9IGxhYmVsQXR0cnNba2V5XTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dmFyIGxhYmVsID0gcGF0aC50ZXh0KGxhYmVsU3BlYyk7XG5cdFx0dGhpcy5fbm9kZUluZGV4VG9MYWJlbFtub2RlLmluZGV4XSA9IGxhYmVsO1xuXHRcdHRoaXMuX3NjZW5lLmFkZENoaWxkKGxhYmVsKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZW1vdmVzIGEgbGFiZWwgZm9yIGEgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRyZW1vdmVMYWJlbCA6IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHR2YXIgdGV4dE9iamVjdCA9IHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZS5pbmRleF07XG5cdFx0aWYgKHRleHRPYmplY3QpIHtcblx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKHRleHRPYmplY3QpO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZS5pbmRleF07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBFdmVudCBoYW5kbGVyIGZvciBtb3VzZW92ZXIgb2YgYSBub2RlXG5cdCAqIEBwYXJhbSBjYWxsYmFjayhub2RlKVxuXHQgKiBAcGFyYW0gc2VsZiAtIHRoZSBvYmplY3QgdG8gYmUgYm91bmQgYXMgJ3RoaXMnIGluIHRoZSBjYWxsYmFja1xuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRub2RlT3ZlciA6IGZ1bmN0aW9uKGNhbGxiYWNrLHNlbGYpIHtcblx0XHRpZiAoIXNlbGYpIHtcblx0XHRcdHNlbGYgPSB0aGlzO1xuXHRcdH1cblx0XHR0aGlzLl9ub2RlT3ZlciA9IGNhbGxiYWNrLmJpbmQoc2VsZik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEV2ZW50IGhhbmRsZXIgZm9yIG1vdXNlb3V0IG9mIGEgbm9kZVxuXHQgKiBAcGFyYW0gY2FsbGJhY2sobm9kZSlcblx0ICogQHBhcmFtIHNlbGYgLSB0aGUgb2JqZWN0IHRvIGJlIGJvdW5kIGFzICd0aGlzJyBpbiB0aGUgY2FsbGJhY2tcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bm9kZU91dCA6IGZ1bmN0aW9uKGNhbGxiYWNrLHNlbGYpIHtcblx0XHRpZiAoIXNlbGYpIHtcblx0XHRcdHNlbGYgPSB0aGlzO1xuXHRcdH1cblx0XHR0aGlzLl9ub2RlT3V0ID0gY2FsbGJhY2suYmluZChzZWxmKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogQ29udmVuaWVuY2UgZnVuY3Rpb24gZm9yIHNldHRpbmcgbm9kZU92ZXIvbm9kZU91dCBpbiBhIHNpbmdsZSBjYWxsXG5cdCAqIEBwYXJhbSBvdmVyIC0gdGhlIG5vZGVPdmVyIGV2ZW50IGhhbmRsZXJcblx0ICogQHBhcmFtIG91dCAtIHRoZSBub2RlT3V0IGV2ZW50IGhhbmRsZXJcblx0ICogQHBhcmFtIHNlbGYgLSB0aGUgb2JqZWN0IHRvIGJlIGJvdW5kIGFzICd0aGlzJyBpbiB0aGUgY2FsbGJhY2tcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bm9kZUhvdmVyIDogZnVuY3Rpb24ob3ZlcixvdXQsc2VsZikge1xuXHRcdGlmICghc2VsZikge1xuXHRcdFx0c2VsZiA9IHRoaXM7XG5cdFx0fVxuXHRcdHRoaXMubm9kZU92ZXIob3ZlcixzZWxmKTtcblx0XHR0aGlzLm5vZGVPdXQob3V0LHNlbGYpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBFdmVudCBoYW5kbGVyIGZvciBjbGljayBvZiBhIG5vZGVcblx0ICogQHBhcmFtIGNhbGxiYWNrKG5vZGUpXG5cdCAqIEBwYXJhbSBzZWxmIC0gdGhlIG9iamVjdCB0byBiZSBib3VuZCBhcyAndGhpcycuICAgRGVmYXVsdHMgdG8gdGhlIGdyYXBoIG9iamVjdFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRub2RlQ2xpY2sgOiBmdW5jdGlvbihjYWxsYmFjayxzZWxmKSB7XG5cdFx0aWYgKCFzZWxmKSB7XG5cdFx0XHRzZWxmID0gdGhpcztcblx0XHR9XG5cdFx0dGhpcy5fbm9kZUNsaWNrID0gY2FsbGJhY2suYmluZChzZWxmKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogUGFuIHtHcmFwaH0gYnkgKGR4LGR5KS4gICBBdXRvbWF0aWNhbGx5IHJlcmVuZGVyIHRoZSBncmFwaC5cblx0ICogQHBhcmFtIGR4IC0gQW1vdW50IG9mIHBhbiBpbiB4IGRpcmVjdGlvblxuXHQgKiBAcGFyYW0gZHkgLSBBbW91bnQgb2YgcGFuIGluIHkgZGlyZWN0aW9uXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfcGFuIDogZnVuY3Rpb24oZHgsZHkpIHtcblx0XHR0aGlzLl9zY2VuZS54ICs9IGR4O1xuXHRcdHRoaXMuX3NjZW5lLnkgKz0gZHk7XG5cdFx0dGhpcy5fcGFuWCArPSBkeDtcblx0XHR0aGlzLl9wYW5ZICs9IGR5O1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE1ha2Uge0dyYXBofSBwYW5uYWJsZVxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRwYW5uYWJsZSA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX3Bhbm5hYmxlID0gdHJ1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogTWFrZXMgdGhlIGdyYXBoIHBhbiBpbiB0aGUgb3Bwb3NpdGUgZGlyZWN0aW9uIG9mIHRoZSBtb3VzZSBhcyBvcHBvc2VkIHRvIHdpdGggaXRcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0aW52ZXJ0UGFuIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5faW52ZXJ0ZWRQYW4gPSAtMTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogTWFrZSBub2RlcyBpbiB7R3JhcGh9IHJlcG9pc2l0aW9uYWJsZSBieSBjbGljay1kcmFnZ2luZ1xuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRkcmFnZ2FibGUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9kcmFnZ2FibGUgPSB0cnVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdF9nZXRab29tRm9yTGV2ZWwgOiBmdW5jdGlvbihsZXZlbCkge1xuXHRcdHZhciBmYWN0b3IgPSBNYXRoLnBvdygxLjUgLCBNYXRoLmFicyhsZXZlbCAtIHRoaXMuX3pvb21MZXZlbCkpO1xuXHRcdGlmIChsZXZlbCA8IHRoaXMuX3pvb21MZXZlbCkge1xuXHRcdFx0ZmFjdG9yID0gMS9mYWN0b3I7XG5cdFx0fVxuXHRcdHJldHVybiBmYWN0b3I7XG5cdH0sXG5cblx0X3pvb20gOiBmdW5jdGlvbihmYWN0b3IseCx5KSB7XG5cdFx0dGhpcy5fem9vbVNjYWxlICo9IGZhY3Rvcjtcblx0XHR0aGlzLl9sYXlvdXRlci5fem9vbVNjYWxlID0gdGhpcy5fem9vbVNjYWxlO1xuXG5cdFx0Ly8gUGFuIHNjZW5lIGJhY2sgdG8gb3JpZ2luXG5cdFx0dmFyIG9yaWdpbmFsWCA9IHRoaXMuX3NjZW5lLng7XG5cdFx0dmFyIG9yaWdpbmFsWSA9IHRoaXMuX3NjZW5lLnk7XG5cdFx0dGhpcy5fcGFuKC10aGlzLl9zY2VuZS54LC10aGlzLl9zY2VuZS55KTtcblxuXHRcdHZhciBtb3VzZVggPSB4IHx8IDA7XG5cdFx0dmFyIG1vdXNlWSA9IHkgfHwgMDtcblxuXHRcdC8vICdab29tJyBub2Rlcy4gICBXZSBkbyB0aGlzIHNvIHRleHQvcmFkaXVzIHNpemUgcmVtYWlucyBjb25zaXN0ZW50IGFjcm9zcyB6b29tIGxldmVsc1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fbm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMuX2xheW91dGVyLl9zZXROb2RlUG9zaXRpb24odGhpcy5fbm9kZXNbaV0sdGhpcy5fbm9kZXNbaV0ueCpmYWN0b3IsIHRoaXMuX25vZGVzW2ldLnkqZmFjdG9yLHRydWUpO1xuXHRcdH1cblxuXHRcdC8vIFpvb20gdGhlIHJlbmRlciBncm91cHNcblx0XHR0aGlzLl9hZGRQcmVBbmRQb3N0UmVuZGVyT2JqZWN0cygpO1xuXG5cblx0XHQvLyBSZXZlcnNlIHRoZSAnb3JpZ2luIHBhbicgd2l0aCB0aGUgc2NhbGUgYXBwbGllZCBhbmQgcmVjZW50ZXIgdGhlIG1vdXNlIHdpdGggc2NhbGUgYXBwbGllZCBhcyB3ZWxsXG5cdFx0dmFyIG5ld01vdXNlWCA9IG1vdXNlWCpmYWN0b3I7XG5cdFx0dmFyIG5ld01vdXNlWSA9IG1vdXNlWSpmYWN0b3I7XG5cdFx0dGhpcy5fcGFuKG9yaWdpbmFsWCpmYWN0b3IgLSAobmV3TW91c2VYLW1vdXNlWCksb3JpZ2luYWxZKmZhY3RvciAtIChuZXdNb3VzZVktbW91c2VZKSk7XG5cblxuXHRcdC8vIFVwZGF0ZSB0aGUgcmVncm91cCB1bmRlcmxheXNcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0aWYgKHRoaXMuX2hhbmRsZUdyb3VwICYmIHRoaXMuX2hhbmRsZUdyb3VwLmNoaWxkcmVuICYmIHRoaXMuX2hhbmRsZUdyb3VwLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5faGFuZGxlR3JvdXAucmVtb3ZlQWxsKCk7XG5cdFx0XHR0aGF0Ll9zY2VuZS51cGRhdGUoKTtcblx0XHRcdHRoYXQuX2FkZFJlZ3JvdXBIYW5kbGVzKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBNYWtlIHtHcmFwaH0gem9vbWFibGUgYnkgdXNpbmcgdGhlIG1vdXNld2hlZWxcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0em9vbWFibGUgOiBmdW5jdGlvbigpIHtcblx0XHRpZiAoIXRoaXMuX3pvb21hYmxlKSB7XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHQkKHRoaXMuX2NhbnZhcykub24oJ21vdXNld2hlZWwnLGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRpZiAodGhhdC5fZXZlbnRzU3VzcGVuZGVkKCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHdoZWVsID0gZS5vcmlnaW5hbEV2ZW50LndoZWVsRGVsdGEvMTIwOy8vbiBvciAtblxuXHRcdFx0XHR2YXIgZmFjdG9yO1xuXHRcdFx0XHRpZiAod2hlZWwgPCAwKSB7XG5cdFx0XHRcdFx0ZmFjdG9yID0gdGhhdC5fZ2V0Wm9vbUZvckxldmVsKHRoYXQuX3pvb21MZXZlbC0xKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmYWN0b3IgPSB0aGF0Ll9nZXRab29tRm9yTGV2ZWwodGhhdC5fem9vbUxldmVsKzEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoYXQuX3pvb20oZmFjdG9yLCBlLm9mZnNldFgsIGUub2Zmc2V0WSk7XG5cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fem9vbWFibGUgPSB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgbGF5b3V0IGZ1bmN0aW9uIGZvciB0aGUgbm9kZXNcblx0ICogQHBhcmFtIGxheW91dGVyIC0gQW4gaW5zdGFuY2UgKG9yIHN1YmNsYXNzKSBvZiBMYXlvdXRcblx0ICogQHJldHVybnMge0dyYXBofSBpcyBsYXlvdXRlciBwYXJhbSBpcyBkZWZpbmVkLCB0aGUgbGF5b3V0ZXIgb3RoZXJ3aXNlXG5cdCAqL1xuXHRsYXlvdXRlciA6IGZ1bmN0aW9uKGxheW91dGVyKSB7XG5cdFx0aWYgKGxheW91dGVyKSB7XG5cdFx0XHR0aGlzLl9sYXlvdXRlciA9IGxheW91dGVyO1xuXHRcdFx0dGhpcy5fbGF5b3V0ZXJcblx0XHRcdFx0Lm5vZGVzKHRoaXMuX25vZGVzKVxuXHRcdFx0XHQubGlua01hcCh0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lKVxuXHRcdFx0XHQubm9kZU1hcCh0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZSlcblx0XHRcdFx0LmxhYmVsTWFwKHRoaXMuX25vZGVJbmRleFRvTGFiZWwpXG5cdFx0XHRcdC5zY2VuZSh0aGlzLl9zY2VuZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9sYXlvdXRlcjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFBlcmZvcm1zIGEgbGF5b3V0IG9mIHRoZSBncmFwaFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRsYXlvdXQgOiBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdGlmICh0aGlzLl9sYXlvdXRlcikge1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5fbGF5b3V0ZXIubGF5b3V0KHRoaXMuX2NhbnZhcy53aWR0aCx0aGlzLl9jYW52YXMuaGVpZ2h0LGNhbGxiYWNrKTtcblxuXG5cdFx0XHQvLyBVcGRhdGUgdGhlIHJlZ3JvdXAgdW5kZXJsYXlzXG5cdFx0XHRpZiAodGhpcy5faGFuZGxlR3JvdXAgJiYgdGhpcy5faGFuZGxlR3JvdXAuY2hpbGRyZW4pIHtcblx0XHRcdFx0dmFyIHVuZGVybGF5cyA9IHRoaXMuX2hhbmRsZUdyb3VwLmNoaWxkcmVuO1xuXHRcdFx0XHR1bmRlcmxheXMuZm9yRWFjaChmdW5jdGlvbihoYW5kbGVPYmplY3QpIHtcblx0XHRcdFx0XHR2YXIgaW5kaWNlcyA9IGhhbmRsZU9iamVjdC5ncmFwaGpzX2luZGljZXM7XG5cdFx0XHRcdFx0dmFyIGJiID0gdGhhdC5fbGF5b3V0ZXIuZ2V0Qm91bmRpbmdCb3goaW5kaWNlcywgUkVHUk9VTkRfQkJfUEFERElORyk7XG5cdFx0XHRcdFx0aWYgKGhhbmRsZU9iamVjdC5ncmFwaGpzX3R5cGUgPT09ICdyZWdyb3VwX3VuZGVybGF5Jykge1xuXHRcdFx0XHRcdFx0aGFuZGxlT2JqZWN0LnR3ZWVuQXR0cih7XG5cdFx0XHRcdFx0XHRcdHg6IGJiLngsXG5cdFx0XHRcdFx0XHRcdHk6IGJiLnksXG5cdFx0XHRcdFx0XHRcdHdpZHRoOiBiYi53aWR0aCxcblx0XHRcdFx0XHRcdFx0aGVpZ2h0OiBiYi5oZWlnaHRcblx0XHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdFx0ZHVyYXRpb246IHRoYXQuX2xheW91dGVyLmR1cmF0aW9uKCksXG5cdFx0XHRcdFx0XHRcdGVhc2luZzogdGhhdC5fbGF5b3V0ZXIuZWFzaW5nKClcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaGFuZGxlT2JqZWN0LmdyYXBoanNfdHlwZSA9PT0gJ3JlZ3JvdXBfaWNvbicpIHtcblx0XHRcdFx0XHRcdHZhciB1bmdyb3VwZWROb2RlcyA9IHRoYXQuX2dyb3VwaW5nTWFuYWdlci5nZXRVbmdyb3VwZWROb2Rlc0ZvcktleShoYW5kbGVPYmplY3QuZ3JhcGhqc19ncm91cF9rZXkpO1xuXHRcdFx0XHRcdFx0dmFyIGljb25Qb3NpdGlvbiA9IHRoYXQuX2dyb3VwaW5nTWFuYWdlci5nZXRNaW5pbWl6ZUljb25Qb3NpdGlvbihiYix1bmdyb3VwZWROb2Rlcyk7XG5cdFx0XHRcdFx0XHRoYW5kbGVPYmplY3QudHdlZW5BdHRyKHtcblx0XHRcdFx0XHRcdFx0eDogaWNvblBvc2l0aW9uLngsXG5cdFx0XHRcdFx0XHRcdHk6IGljb25Qb3NpdGlvbi55XG5cdFx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRcdGR1cmF0aW9uOiB0aGF0Ll9sYXlvdXRlci5kdXJhdGlvbigpLFxuXHRcdFx0XHRcdFx0XHRlYXNpbmc6IHRoYXQuX2xheW91dGVyLmVhc2luZygpXG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGdyb3VwaW5nIG1hbmFnZXIuXG5cdCAqIEBwYXJhbSBncm91cGluZ01hbmFnZXJcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRncm91cGluZ01hbmFnZXIgOiBmdW5jdGlvbihncm91cGluZ01hbmFnZXIpIHtcblx0XHRpZiAoZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0XHR0aGlzLl9ncm91cGluZ01hbmFnZXIgPSBncm91cGluZ01hbmFnZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9ncm91cGluZ01hbmFnZXI7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0aGUgZ3JvdXBpbmcgbWFuYWdlciBwcm92aWRlZCBhbmQgY2FsbHMgdGhlIG1ldGhvZHMgZm9yIGFnZ3JlZ2F0aW5nIG5vZGVzIGFuZCBsaW5rc1xuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRpbml0aWFsaXplR3JvdXBpbmcgOiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy5fZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cblx0XHRcdHRoaXMuX25vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHRub2RlLnBhcmVudCA9IHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl9ncm91cGluZ01hbmFnZXIubm9kZXModGhpcy5fbm9kZXMpXG5cdFx0XHRcdC5saW5rcyh0aGlzLl9saW5rcylcblx0XHRcdFx0LmluaXRpYWxpemVIZWlyYXJjaHkoKTtcblxuXHRcdFx0dGhpcy5ub2Rlcyh0aGlzLl9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZE5vZGVzKCkpO1xuXHRcdFx0dGhpcy5saW5rcyh0aGlzLl9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZExpbmtzKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogVW5ncm91cHMgdGhlIHByb2RpZGVkIGFnZ3JlZ2F0ZSBub2RlXG5cdCAqIEBwYXJhbSBub2RlIC0gdGhlIGFnZ3JlZ2F0ZSBub2RlIHRvIGJlIHVuZ3JvdXBlZFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHR1bmdyb3VwIDogZnVuY3Rpb24obm9kZSkge1xuXHRcdGlmICghbm9kZSB8fCAhbm9kZS5jaGlsZHJlbikge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRpZiAodGhpcy5fZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0XHR0aGlzLl9ncm91cGluZ01hbmFnZXIudW5ncm91cChub2RlKTtcblx0XHRcdHRoaXMuY2xlYXIoKVxuXHRcdFx0XHQubm9kZXModGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmFnZ3JlZ2F0ZWROb2RlcygpKVxuXHRcdFx0XHQubGlua3ModGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmFnZ3JlZ2F0ZWRMaW5rcygpKVxuXHRcdFx0XHQuZHJhdygpO1xuXG5cdFx0XHR0aGlzLl9sYXlvdXRlci5fYXBwbHlab29tU2NhbGUodHJ1ZSk7XG5cdFx0XHR0aGlzLmxheW91dCgpO1xuXHRcdFx0dGhpcy5fbGF5b3V0ZXIuX2FwcGx5Wm9vbVNjYWxlKGZhbHNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlZ3JvdXBzIHRoZSBhZ2dyZWdhdGUgbm9kZS4gICBDYW4gYmUgY2FsbGVkIHByb2dyYW1hdHRpY2FsbHkgYnV0IGlzIGF1dG9tYXRpY2FsbHkgaW52b2tlZCB3aGVuIGNsaWNraW5nIG9uIHRoZVxuXHQgKiByZWdyb3VwIGhhbmRsZXJcblx0ICogQHBhcmFtIHVuZ3JvdXBlZEFnZ3JlZ2F0ZUtleVxuXHQgKi9cblx0cmVncm91cCA6IGZ1bmN0aW9uKHVuZ3JvdXBlZEFnZ3JlZ2F0ZUtleSkge1xuXHRcdC8vIEFuaW1hdGUgdGhlIHJlZ3JvdXBcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0dmFyIHBhcmVudEFnZ3JlZ2F0ZSA9IHRoaXMuX2dyb3VwaW5nTWFuYWdlci5nZXRBZ2dyZWdhdGUodW5ncm91cGVkQWdncmVnYXRlS2V5KTtcblxuXHRcdHZhciBhdmdQb3MgPSB7IHg6IDAsIHkgOiAwfTtcblx0XHR2YXIgbWF4UmFkaXVzID0gMDtcblx0XHRwYXJlbnRBZ2dyZWdhdGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuXHRcdFx0YXZnUG9zLnggKz0gY2hpbGQueDtcblx0XHRcdGF2Z1Bvcy55ICs9IGNoaWxkLnk7XG5cdFx0fSk7XG5cdFx0YXZnUG9zLnggLz0gcGFyZW50QWdncmVnYXRlLmNoaWxkcmVuLmxlbmd0aDtcblx0XHRhdmdQb3MueSAvPSBwYXJlbnRBZ2dyZWdhdGUuY2hpbGRyZW4ubGVuZ3RoO1xuXG5cdFx0dmFyIGluZGV4T2ZDaGlsZHJlbiA9IHBhcmVudEFnZ3JlZ2F0ZS5jaGlsZHJlbi5tYXAoZnVuY3Rpb24oY2hpbGQpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLl9hZ2dyZWdhdGVkTm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoYXQuX2dyb3VwaW5nTWFuYWdlci5fYWdncmVnYXRlZE5vZGVzW2ldLmluZGV4ID09PSBjaGlsZC5pbmRleCkge1xuXHRcdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dmFyIG1pbkNoaWxkSW5kZXggPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXHRcdGluZGV4T2ZDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGlkeCkge1xuXHRcdFx0bWluQ2hpbGRJbmRleCA9IE1hdGgubWluKG1pbkNoaWxkSW5kZXgsaWR4KTtcblx0XHR9KTtcblxuXHRcdHZhciBhbmltYXRlZFJlZ3JvdXBlZCA9IDA7XG5cdFx0dGhpcy5fc3VzcGVuZEV2ZW50cygpO1x0XHRcdC8vIGxheW91dCB3aWxsIHJlc3VtZSB0aGVtXG5cdFx0cGFyZW50QWdncmVnYXRlLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcblxuXHRcdFx0Ly9UT0RPOiAgIFdoZW4gd2UgY2FuIHN1cHBvcnQgdHJhbnNwYXJlbnQgdGV4dCBpbiBwYXRoLCBmYWRlIG91dCB0aGUgbGFiZWwgYXMgd2UgbW92ZSBpdCB0b2dldGhlciBpZiBpdCdzIHNob3dpbmdcblx0XHRcdHRoYXQucmVtb3ZlTGFiZWwoY2hpbGQpO1xuXHRcdFx0dGhhdC5fbGF5b3V0ZXIuX3NldE5vZGVQb3NpdGlvbihjaGlsZCxhdmdQb3MueCxhdmdQb3MueSxmYWxzZSxmdW5jdGlvbigpIHtcblx0XHRcdFx0YW5pbWF0ZWRSZWdyb3VwZWQrKztcblx0XHRcdFx0aWYgKGFuaW1hdGVkUmVncm91cGVkID09PSBwYXJlbnRBZ2dyZWdhdGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2dyb3VwaW5nTWFuYWdlcikge1xuXHRcdFx0XHRcdFx0dmFyIHJlZ3JvdXBlZEFnZ3JlZ2F0ZSA9IHRoYXQuX2dyb3VwaW5nTWFuYWdlci5yZWdyb3VwKHVuZ3JvdXBlZEFnZ3JlZ2F0ZUtleSxtaW5DaGlsZEluZGV4KTtcblx0XHRcdFx0XHRcdHJlZ3JvdXBlZEFnZ3JlZ2F0ZS54ID0gYXZnUG9zLng7XG5cdFx0XHRcdFx0XHRyZWdyb3VwZWRBZ2dyZWdhdGUueSA9IGF2Z1Bvcy55O1xuXHRcdFx0XHRcdFx0dGhhdC5jbGVhcigpXG5cdFx0XHRcdFx0XHRcdC5ub2Rlcyh0aGF0Ll9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZE5vZGVzKCkpXG5cdFx0XHRcdFx0XHRcdC5saW5rcyh0aGF0Ll9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZExpbmtzKCkpO1xuXHRcdFx0XHRcdFx0dGhhdC5kcmF3KCk7XG5cdFx0XHRcdFx0XHR0aGF0Ll9sYXlvdXRlci5fYXBwbHlab29tU2NhbGUodHJ1ZSk7XG5cdFx0XHRcdFx0XHR0aGF0LmxheW91dCgpO1xuXHRcdFx0XHRcdFx0dGhhdC5fbGF5b3V0ZXIuX2FwcGx5Wm9vbVNjYWxlKGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9udCBzaXplIGZvciBsYWJlbHNcblx0ICogQHBhcmFtIGZvbnRTaXplIC0gc2l6ZSBvZiB0aGUgZm9udCBpbiBwaXhlbHNcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBmb250U2l6ZSBwYXJhbSBpcyBkZWlmbmVkLCB7R3JhcGguX2ZvbnRTaXplfSBvdGhlcndpc2Vcblx0ICovXG5cdGZvbnRTaXplIDogZnVuY3Rpb24oZm9udFNpemUpIHtcblx0XHRpZiAoZm9udFNpemUpIHtcblx0XHRcdHRoaXMuX2ZvbnRTaXplID0gZm9udFNpemU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb250U2l6ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9udCBjb2xvdXIgZm9yIGxhYmVsc1xuXHQgKiBAcGFyYW0gZm9udENvbG91ciAtIEEgaGV4IHN0cmluZyBmb3IgdGhlIGNvbG91ciBvZiB0aGUgbGFiZWxzXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgZm9udENvbG91ciBwYXJhbSBpcyBkZWlmbmVkLCB7R3JhcGguX2ZvbnRDb2xvdXJ9IG90aGVyd2lzZVxuXHQgKi9cblx0Zm9udENvbG91ciA6IGZ1bmN0aW9uKGZvbnRDb2xvdXIpIHtcblx0XHRpZiAoZm9udENvbG91cikge1xuXHRcdFx0dGhpcy5fZm9udENvbG9yID0gZm9udENvbG91cjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZvbnRDb2xvcjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9udCBzdHJva2UgZm9yIGxhYmVsc1xuXHQgKiBAcGFyYW0gZm9udFN0cm9rZSAtIEEgaGV4IHN0cmluZyBmb3IgdGhlIGNvbG9yIG9mIHRoZSBsYWJlbCBzdHJva2Vcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBmb250U3Ryb2tlIHBhcmFtIGlzIGRlZmluZWQsIHtHcmFwaC5fZm9udFN0cm9rZX0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRmb250U3Ryb2tlIDogZnVuY3Rpb24oZm9udFN0cm9rZSkge1xuXHRcdGlmIChmb250U3Ryb2tlKSB7XG5cdFx0XHR0aGlzLl9mb250U3Ryb2tlID0gZm9udFN0cm9rZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZvbnRTdHJva2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvbnQgc3Ryb2tlIHdpZHRoIGZvciBsYWJlbHNcblx0ICogQHBhcmFtIGZvbnRTdHJva2VXaWR0aCAtIHNpemUgaW4gcGl4ZWxzXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgZm9udFN0cm9rZVdpZHRoIHBhcmFtIGlzIGRlZmluZWQsIHtHcmFwaC5fZm9udFN0cm9rZVdpZHRofSBvdGhlcndpc2Vcblx0ICovXG5cdGZvbnRTdHJva2VXaWR0aCA6IGZ1bmN0aW9uKGZvbnRTdHJva2VXaWR0aCkge1xuXHRcdGlmIChmb250U3Ryb2tlV2lkdGgpIHtcblx0XHRcdHRoaXMuX2ZvbnRTdHJva2VXaWR0aCA9IGZvbnRTdHJva2VXaWR0aDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZvbnRTdHJva2VXaWR0aDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9udCBmYW1pbHkgZm9yIGxhYmVsc1xuXHQgKiBAcGFyYW0gZm9udEZhbWlseSAtIEEgc3RyaW5nIGZvciB0aGUgZm9udCBmYW1pbHkgKGEgbGEgSFRNTDUgQ2FudmFzKVxuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGZvbnRGYW1pbHkgcGFyYW0gaXMgZGVpZm5lZCwge0dyYXBoLl9mb250RmFtaWx5fSBvdGhlcndpc2Vcblx0ICovXG5cdGZvbnRGYW1pbHkgOiBmdW5jdGlvbihmb250RmFtaWx5KSB7XG5cdFx0aWYgKGZvbnRGYW1pbHkpIHtcblx0XHRcdHRoaXMuX2ZvbnRGYW1pbHkgPSBmb250RmFtaWx5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZm9udEZhbWlseTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9udCBzaGFkb3cgcHJvcGVydGllcyBmb3IgbGFiZWxzXG5cdCAqIEBwYXJhbSBjb2xvciAtIHRoZSBjb2xvdXIgb2YgdGhlIHNoYWRvd1xuXHQgKiBAcGFyYW0gb2Zmc2V0WCAtIHRoZSB4IG9mZnNldCBvZiB0aGUgc2hhZG93IGZyb20gY2VudGVyXG5cdCAqIEBwYXJhbSBvZmZzZXRZIC0gdGhlIHkgb2Zmc2V0IG9mIHRoZSBzaGFkb3cgZnJvbSBjZW50ZXJcblx0ICogQHBhcmFtIGJsdXIgLSB0aGUgYW1vdW50IG9mIGJsdXIgYXBwbGllZCB0byB0aGUgc2hhZG93IGluIHBpeGVsc1xuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdGZvbnRTaGFkb3cgOiBmdW5jdGlvbihjb2xvcixvZmZzZXRYLG9mZnNldFksYmx1cikge1xuXHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb2xvcjogdGhpcy5fc2hhZG93Q29sb3IsXG5cdFx0XHRcdG9mZnNldFg6IHRoaXMuX3NoYWRvd09mZnNldFgsXG5cdFx0XHRcdG9mZnNldFk6IHRoaXMuX3NoYWRvd09mZnNldFksXG5cdFx0XHRcdGJsdXI6IHRoaXMuX3NoYWRvd0JsdXJcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3NoYWRvd0NvbG9yID0gY29sb3I7XG5cdFx0XHR0aGlzLl9zaGFkb3dPZmZzZXRYID0gb2Zmc2V0WDtcblx0XHRcdHRoaXMuX3NoYWRvd09mZnNldFkgPSBvZmZzZXRZO1xuXHRcdFx0dGhpcy5fc2hhZG93Qmx1ciA9IGJsdXI7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlc2l6ZSB0aGUgZ3JhcGguICBBdXRvbWF0aWNhbGx5IHBlcmZvcm1zIGxheW91dCBhbmQgcmVyZW5kZXJzIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gdyAtIHRoZSBuZXcgd2lkdGhcblx0ICogQHBhcmFtIGggLSB0aGUgbmV3IGhlaWdodFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRyZXNpemUgOiBmdW5jdGlvbih3LGgpIHtcblx0XHR0aGlzLl93aWR0aCA9IHc7XG5cdFx0dGhpcy5faGVpZ2h0ID0gaDtcblx0XHQkKHRoaXMuX2NhbnZhcykuYXR0cih7d2lkdGg6dyxoZWlnaHQ6aH0pXG5cdFx0XHQud2lkdGgodylcblx0XHRcdC5oZWlnaHQoaCk7XG5cdFx0dGhpcy5fc2NlbmUucmVzaXplKHcsaCk7XG5cblx0XHRpZiAoIXRoaXMuX3Bhbm5hYmxlICYmICF0aGlzLl96b29tYWJsZSkge1xuXHRcdFx0dGhpcy5sYXlvdXQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2NlbmUudXBkYXRlKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzIGEgbGlzdCBvZiBwcmUvcG9zdCByZW5kZXIgb2JqZWN0cyBmcm9tIHRoZSBsYXlvdXRlciAoaWYgYW55KVxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2FkZFByZUFuZFBvc3RSZW5kZXJPYmplY3RzIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5fcHJlcmVuZGVyR3JvdXAucmVtb3ZlQWxsKCk7XG5cblx0XHQvLyBHZXQgdGhlIGJhY2tncm91bmQgb2JqZWN0cyBmcm9tIHRoZSBsYXlvdXRlclxuXHRcdHZhciBvYmpzID0gdGhpcy5fbGF5b3V0ZXIucHJlcmVuZGVyKHRoaXMuX3dpZHRoLHRoaXMuX2hlaWdodCk7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGlmIChvYmpzKSB7XG5cdFx0XHRvYmpzLmZvckVhY2goZnVuY3Rpb24ocmVuZGVyT2JqZWN0KSB7XG5cdFx0XHRcdHRoYXQuX3ByZXJlbmRlckdyb3VwLmFkZENoaWxkKHJlbmRlck9iamVjdCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9wb3N0cmVuZGVyR3JvdXAucmVtb3ZlQWxsKCk7XG5cdFx0b2JqcyA9IHRoaXMuX2xheW91dGVyLnBvc3RyZW5kZXIodGhpcy5fd2lkdGgsdGhpcy5faGVpZ2h0KTtcblx0XHRpZiAob2Jqcykge1xuXHRcdFx0b2Jqcy5mb3JFYWNoKGZ1bmN0aW9uKHJlbmRlck9iamVjdCkge1xuXHRcdFx0XHR0aGF0Ll9wb3N0cmVuZGVyR3JvdXAuYWRkQ2hpbGQocmVuZGVyT2JqZWN0KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBjbGlja2FibGUgYm94ZXMgdG8gcmVncm91cCBhbnkgdW5ncm91cGVkIGFnZ3JlZ2F0ZXNcblx0ICogVE9ETzogIG1ha2UgdGhpcyBsb29rIGJldHRlciFcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9hZGRSZWdyb3VwSGFuZGxlcyA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRpZiAodGhpcy5fZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0XHR2YXIgdW5ncm91cGVkTm9kZXNJbmZvID0gdGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmdldFVuZ3JvdXBlZE5vZGVzKCk7XG5cdFx0XHR1bmdyb3VwZWROb2Rlc0luZm8uZm9yRWFjaChmdW5jdGlvbih1bmdyb3VwZWROb2RlSW5mbykge1xuXHRcdFx0XHR2YXIgaW5kaWNlcyA9IHVuZ3JvdXBlZE5vZGVJbmZvLmluZGljZXM7XG5cdFx0XHRcdHZhciBrZXkgPSB1bmdyb3VwZWROb2RlSW5mby5rZXk7XG5cdFx0XHRcdHZhciBiYm94ID0gdGhhdC5fbGF5b3V0ZXIuZ2V0Qm91bmRpbmdCb3goaW5kaWNlcyxSRUdST1VORF9CQl9QQURESU5HKTtcblx0XHRcdFx0dmFyIGljb25Qb3NpdGlvbiA9IHRoYXQuX2dyb3VwaW5nTWFuYWdlci5nZXRNaW5pbWl6ZUljb25Qb3NpdGlvbihiYm94LHRoYXQuX2dyb3VwaW5nTWFuYWdlci5nZXRVbmdyb3VwZWROb2Rlc0ZvcktleShrZXkpKTtcblx0XHRcdFx0dmFyIG1pbmltaXplUmVuZGVyT2JqZWN0ID0gcGF0aC5pbWFnZSh7XG5cdFx0XHRcdFx0c3JjIDogJ2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBQlFBQUFBVUNBWUFBQUNOaVIwTkFBQUFBWE5TUjBJQXJzNGM2UUFBQUFsd1NGbHpBQUVRaEFBQkVJUUJQMFZGWUFBQUFjdHBWRmgwV0UxTU9tTnZiUzVoWkc5aVpTNTRiWEFBQUFBQUFEeDRPbmh0Y0cxbGRHRWdlRzFzYm5NNmVEMGlZV1J2WW1VNmJuTTZiV1YwWVM4aUlIZzZlRzF3ZEdzOUlsaE5VQ0JEYjNKbElEVXVOQzR3SWo0S0lDQWdQSEprWmpwU1JFWWdlRzFzYm5NNmNtUm1QU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh4T1RrNUx6QXlMekl5TFhKa1ppMXplVzUwWVhndGJuTWpJajRLSUNBZ0lDQWdQSEprWmpwRVpYTmpjbWx3ZEdsdmJpQnlaR1k2WVdKdmRYUTlJaUlLSUNBZ0lDQWdJQ0FnSUNBZ2VHMXNibk02ZUcxd1BTSm9kSFJ3T2k4dmJuTXVZV1J2WW1VdVkyOXRMM2hoY0M4eExqQXZJZ29nSUNBZ0lDQWdJQ0FnSUNCNGJXeHVjenAwYVdabVBTSm9kSFJ3T2k4dmJuTXVZV1J2WW1VdVkyOXRMM1JwWm1Zdk1TNHdMeUkrQ2lBZ0lDQWdJQ0FnSUR4NGJYQTZRM0psWVhSdmNsUnZiMncrZDNkM0xtbHVhM05qWVhCbExtOXlaend2ZUcxd09rTnlaV0YwYjNKVWIyOXNQZ29nSUNBZ0lDQWdJQ0E4ZEdsbVpqcFBjbWxsYm5SaGRHbHZiajR4UEM5MGFXWm1Pazl5YVdWdWRHRjBhVzl1UGdvZ0lDQWdJQ0E4TDNKa1pqcEVaWE5qY21sd2RHbHZiajRLSUNBZ1BDOXlaR1k2VWtSR1BnbzhMM2c2ZUcxd2JXVjBZVDRLR010VldBQUFBY2hKUkVGVU9CR1ZsVDFPdzBBUVJyMjJRNVJJRVFWQ1JFcERyb0NWR281QVEwOUx6UUVpRHNBUktEZ0JWd2dkVXFLY2dJWW1FcUpDbHZoTmJONW5lWU85c1UwWWFWanY3TGR2WnB6MVlqeHNOQm9kcjFhcksyUE1FZE1lbmlxK2hSazBjWnFtOHlBSXh0UHA5TjRJUm1EaSs3NEhWSXdtbUFDeW9zWUE4NUlrOFNqb0pPajMrN2NFRG9HOUlRd3plZjBmQ3l3cEtPZ2RSZ3ZHMEZlYmVXV2RrcXArVXF6T3FqcGlpT1VUcVh0bmxkVllRc1dvUkQwQnF6SktYeGZYV3AybEF2N0gva3hTQk5vVzNiR1kwRjJ6ODdXbUNMVFozWEV0NXNGZDA3d0VMUUtMRy8vemJKTmtlNnJPWGVKbWJhQUxWaXFxQ013VytXS0NCc0RHa3I0UWJGMkVCYVljU3A4VC80cGZJbnBHdEVNc1ljNWdTbTBSVTFWZkpEOWd2R1o5bDFnR3RjQ0VvSUNQczluc0J0SFdGa1hSQlh1akhCaVUrb2ZTM3ByMEt5enRNV1JRT3lwWDhDVitoNy9nTGJkVllwbFJqWTdLTjc2UG4rSXRQR09vNVJqWDk2eEF5SzF4QnNoakU5TjZzNXI4WXJFRnhTRWI1MkVZNm9MOVpIdWJNYnNVNjFFYkt6b1ZIeFRTWFM2WGM1K0hzWDU2UmwxZmFsdFZxd1YzVk14MWFjVG81b3h4c0Znc25nYUR3WVRDaHJTeGgwQXZ1YmxmQkxucFhjYkFIamhDNS9vWDhBUHNDYXY5dEg2WFhRQUFBQUJKUlU1RXJrSmdnZz09Jyxcblx0XHRcdFx0XHR4IDogaWNvblBvc2l0aW9uLngsXG5cdFx0XHRcdFx0eSA6IGljb25Qb3NpdGlvbi55LFxuXHRcdFx0XHRcdGdyYXBoanNfdHlwZSA6ICdyZWdyb3VwX2ljb24nLFxuXHRcdFx0XHRcdGdyYXBoanNfaW5kaWNlcyA6IGluZGljZXMsXG5cdFx0XHRcdFx0Z3JhcGhqc19ncm91cF9rZXkgOiBrZXksXG5cdFx0XHRcdFx0b3BhY2l0eSA6IDAuOFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR2YXIgYm91bmRpbmdCb3hSZW5kZXJPYmplY3QgPSBwYXRoLnJlY3Qoe1xuXHRcdFx0XHRcdHggOiBiYm94LngsXG5cdFx0XHRcdFx0eSA6IGJib3gueSxcblx0XHRcdFx0XHRncmFwaGpzX3R5cGUgOiAncmVncm91cF91bmRlcmxheScsXG5cdFx0XHRcdFx0Z3JhcGhqc19pbmRpY2VzIDogaW5kaWNlcyxcblx0XHRcdFx0XHR3aWR0aCA6IGJib3gud2lkdGgsXG5cdFx0XHRcdFx0aGVpZ2h0IDogYmJveC5oZWlnaHQsXG5cdFx0XHRcdFx0c3Ryb2tlU3R5bGUgOiAnIzIzMjMyMycsXG5cdFx0XHRcdFx0ZmlsbFN0eWxlIDogJyMwMDAwMDAnLFxuXHRcdFx0XHRcdG9wYWNpdHkgOiAwLjFcblx0XHRcdFx0fSk7XG5cdFx0XHRcdG1pbmltaXplUmVuZGVyT2JqZWN0Lm9uKCdjbGljaycsZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dGhhdC5yZWdyb3VwKGtleSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGF0Ll9oYW5kbGVHcm91cC5hZGRDaGlsZChtaW5pbWl6ZVJlbmRlck9iamVjdCk7XG5cdFx0XHRcdHRoYXQuX2hhbmRsZUdyb3VwLmFkZENoaWxkKGJvdW5kaW5nQm94UmVuZGVyT2JqZWN0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fc2NlbmUudXBkYXRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZWRyYXcgdGhlIGdyYXBoXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB0b3AgPSAtdGhpcy5fc2NlbmUueTtcblx0XHR2YXIgbGVmdCA9IC10aGlzLl9zY2VuZS54O1xuXG5cdFx0dGhpcy5fbGF5b3V0ZXIucG9zdHJlbmRlclVwZGF0ZShsZWZ0LHRvcCxsZWZ0K3RoaXMuX3NjZW5lLndpZHRoLHRvcCt0aGlzLl9zY2VuZS5oZWlnaHQpO1xuXHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBEcmF3IHRoZSBncmFwaC4gICBPbmx5IG5lZWRzIHRvIGJlIGNhbGxlZCBhZnRlciB0aGUgbm9kZXMvbGlua3MgaGF2ZSBiZWVuIHNldFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9XG5cdCAqL1xuXHRkcmF3IDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0aWYgKCF0aGlzLl9zY2VuZSkge1xuXHRcdFx0dGhpcy5fc2NlbmUgPSBwYXRoKHRoaXMuX2NhbnZhcyk7XG5cdFx0XHRpZiAodGhpcy5fbGF5b3V0ZXIpIHtcblx0XHRcdFx0dGhpcy5fbGF5b3V0ZXIuc2NlbmUodGhpcy5fc2NlbmUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2xheW91dGVyKSB7XG5cdFx0XHR2YXIgZGVmYXVsTGF5b3V0ID0gbmV3IExheW91dCgpXG5cdFx0XHRcdC5ub2Rlcyh0aGlzLl9ub2Rlcylcblx0XHRcdFx0Lm5vZGVNYXAodGhpcy5fbm9kZUluZGV4VG9DaXJjbGUpXG5cdFx0XHRcdC5saW5rTWFwKHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmUpXG5cdFx0XHRcdC5sYWJlbE1hcCh0aGlzLl9ub2RlSW5kZXhUb0xhYmVsKVxuXHRcdFx0XHQuc2NlbmUodGhpcy5fc2NlbmUpO1xuXHRcdFx0dGhpcy5sYXlvdXRlcihkZWZhdWxMYXlvdXQpO1xuXHRcdH1cblx0XHR0aGlzLl9wcmVyZW5kZXJHcm91cCA9IHBhdGguZ3JvdXAoKTtcblx0XHR0aGlzLl9oYW5kbGVHcm91cCA9IHBhdGguZ3JvdXAoKTtcblx0XHR0aGlzLl9wb3N0cmVuZGVyR3JvdXAgPSBwYXRoLmdyb3VwKHtub0hpdDp0cnVlfSk7XG5cblxuXHRcdHRoaXMuX3NjZW5lLmFkZENoaWxkKHRoaXMuX3ByZXJlbmRlckdyb3VwKTtcblx0XHR0aGlzLl9zY2VuZS5hZGRDaGlsZCh0aGlzLl9oYW5kbGVHcm91cCk7XG5cdFx0dGhpcy5fbGlua3MuZm9yRWFjaChmdW5jdGlvbihsaW5rKSB7XG5cblx0XHRcdHZhciBsaW5rT2JqZWN0O1xuXHRcdFx0aWYgKCFsaW5rLnR5cGUpIHtcblx0XHRcdFx0bGluay50eXBlID0gTElOS19UWVBFLkRFRkFVTFQ7XG5cdFx0XHR9XG5cdFx0XHRzd2l0Y2gobGluay50eXBlKSB7XG5cdFx0XHRcdGNhc2UgTElOS19UWVBFLkFSUk9XOlxuXHRcdFx0XHRcdGxpbmsuaGVhZE9mZnNldCA9IGxpbmsudGFyZ2V0LnJhZGl1cztcblx0XHRcdFx0XHRsaW5rT2JqZWN0ID0gcGF0aC5hcnJvdyhsaW5rKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBMSU5LX1RZUEUuQVJDOlxuXHRcdFx0XHRcdGxpbmtPYmplY3QgPSBwYXRoLmFyYyhsaW5rKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBMSU5LX1RZUEUuTElORTpcblx0XHRcdFx0Y2FzZSBMSU5LX1RZUEUuREVGQVVMVDpcblx0XHRcdFx0XHRsaW5rT2JqZWN0ID0gcGF0aC5saW5lKGxpbmspO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGxpbmtPYmplY3QgPSBwYXRoLmxpbmUobGluayk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHR0aGF0Ll9ub2RlSW5kZXhUb0xpbmtMaW5lW2xpbmsuc291cmNlLmluZGV4XS5wdXNoKGxpbmtPYmplY3QpO1xuXHRcdFx0dGhhdC5fbm9kZUluZGV4VG9MaW5rTGluZVtsaW5rLnRhcmdldC5pbmRleF0ucHVzaChsaW5rT2JqZWN0KTtcblxuXHRcdFx0dGhhdC5fc2NlbmUuYWRkQ2hpbGQobGlua09iamVjdCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdHZhciBjaXJjbGUgPSBwYXRoLmNpcmNsZShub2RlKTtcblx0XHRcdHRoYXQuX25vZGVJbmRleFRvQ2lyY2xlW25vZGUuaW5kZXhdID0gY2lyY2xlO1xuXHRcdFx0aWYgKHRoYXQuX25vZGVPdmVyIHx8IHRoYXQuX2RyYWdnYWJsZSkge1xuXHRcdFx0XHRjaXJjbGUub2ZmKCdtb3VzZW92ZXInKTtcblx0XHRcdFx0Y2lyY2xlLm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICh0aGF0Ll9ub2RlT3Zlcikge1xuXHRcdFx0XHRcdFx0dGhhdC5fbm9kZU92ZXIoY2lyY2xlLCBlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2N1cnJlbnRNb3ZlU3RhdGUhPT0nZHJhZ2dpbmcnKSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9jdXJyZW50T3Zlck5vZGUgPSBjaXJjbGU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoYXQuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGF0Ll9ub2RlT3V0IHx8IHRoYXQuX2RyYWdnYWJsZSkge1xuXHRcdFx0XHRjaXJjbGUub2ZmKCdtb3VzZW91dCcpO1xuXHRcdFx0XHRjaXJjbGUub24oJ21vdXNlb3V0JywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9ldmVudHNTdXNwZW5kZWQoKSkgeyByZXR1cm47IH1cblx0XHRcdFx0XHRpZiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSE9PSdkcmFnZ2luZycpIHtcblx0XHRcdFx0XHRcdHRoYXQuX2N1cnJlbnRPdmVyTm9kZSA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0aGF0Ll9ub2RlT3V0KSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9ub2RlT3V0KGNpcmNsZSwgZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoYXQuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGF0Ll9ub2RlQ2xpY2spIHtcblx0XHRcdFx0Y2lyY2xlLm9mZignY2xpY2snKTtcblx0XHRcdFx0Y2lyY2xlLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRpZiAodGhhdC5fZXZlbnRzU3VzcGVuZGVkKCkpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0dGhhdC5fbm9kZUNsaWNrKGNpcmNsZSxlKTtcblx0XHRcdFx0XHR0aGF0Ll9zY2VuZS51cGRhdGUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoYXQuX2dyb3VwaW5nTWFuYWdlcikge1xuXHRcdFx0XHRjaXJjbGUub2ZmKCdjbGljaycpO1xuXHRcdFx0XHRjaXJjbGUub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9ldmVudHNTdXNwZW5kZWQoKSkgeyByZXR1cm47IH1cblx0XHRcdFx0XHRpZiAodGhhdC5fbm9kZU91dCkge1xuXHRcdFx0XHRcdFx0dGhhdC5fbm9kZU91dChjaXJjbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGF0LnVuZ3JvdXAoY2lyY2xlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGF0Ll9zY2VuZS5hZGRDaGlsZChjaXJjbGUpO1xuXG5cdFx0XHRpZiAobm9kZS5sYWJlbCkge1xuXHRcdFx0XHR0aGF0LmFkZExhYmVsKG5vZGUsbm9kZS5sYWJlbCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5zaG93QWxsTGFiZWxzKCkpIHtcblx0XHRcdHRoaXMuc2hvd0FsbExhYmVscyh0cnVlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9sYXlvdXRlci5saW5rTWFwKHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmUpXG5cdFx0XHQubm9kZU1hcCh0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZSlcblx0XHRcdC5sYWJlbE1hcCh0aGlzLl9ub2RlSW5kZXhUb0xhYmVsKTtcblxuXG5cdFx0dGhpcy5fYWRkUHJlQW5kUG9zdFJlbmRlck9iamVjdHMoKTtcblxuXHRcdC8vIERyYXcgYW55IHVuZ3JvdXBlZCBub2RlIGJvdW5kaW5nIGJveGVzXG5cdFx0dGhpcy5fYWRkUmVncm91cEhhbmRsZXMoKTtcblxuXHRcdHRoaXMuX3NjZW5lLmFkZENoaWxkKHRoaXMuX3Bvc3RyZW5kZXJHcm91cCk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBEZWJ1ZyByb3V0aW5nIHRvIGRyYXcgYSBib3VuZGluZyBib3ggYXJvdW5kIHRoZSBub2Rlc1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2RlYnVnRHJhd0JvdW5kaW5nQm94IDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGJJbmNsdWRlTGFiZWxzID0gdHJ1ZTtcblx0XHR2YXIgYm91bmRpbmdCb3ggPSB0aGlzLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveCh0aGlzLl9ub2Rlcyx1bmRlZmluZWQsYkluY2x1ZGVMYWJlbHMpO1xuXHRcdGlmICh0aGlzLl9iYlJlbmRlcikge1xuXHRcdFx0dGhpcy5fc2NlbmUucmVtb3ZlQ2hpbGQodGhpcy5fYmJSZW5kZXIpO1xuXHRcdH1cblx0XHR0aGlzLl9iYlJlbmRlciA9IHBhdGgucmVjdCh7XG5cdFx0XHR4IDogYm91bmRpbmdCb3gueCxcblx0XHRcdHkgOiBib3VuZGluZ0JveC55LFxuXHRcdFx0d2lkdGggOiBib3VuZGluZ0JveC53aWR0aCxcblx0XHRcdGhlaWdodCA6IGJvdW5kaW5nQm94LmhlaWdodCxcblx0XHRcdHN0cm9rZVN0eWxlIDogJyNmZjAwMDAnLFxuXHRcdFx0bGluZVdpZHRoIDogMixcblx0XHRcdG5vSGl0IDogdHJ1ZVxuXHRcdH0pO1xuXHRcdHRoaXMuX3NjZW5lLmFkZENoaWxkKHRoaXMuX2JiUmVuZGVyKTtcblx0XHR0aGlzLl9zY2VuZS51cGRhdGUoKTtcblx0fSxcblxuXHQvKipcblx0ICogRml0IHRoZSBncmFwaCB0byB0aGUgc2NyZWVuXG5cdCAqL1xuXHRmaXQgOiBmdW5jdGlvbihwYWRkaW5nKSB7XG5cblx0XHQvLyBSZXR1cm4gYmFjayB0byBvcmlnaW5cblx0XHR0aGlzLl9wYW4oLXRoaXMuX3NjZW5lLngsLXRoaXMuX3NjZW5lLnkpO1xuXG5cblxuXHRcdC8vIFdvcmtpbmcgd2l0aCBiaWcgbnVtYmVycywgaXQncyBiZXR0ZXIgaWYgd2UgZG8gdGhpcyB0d2ljZS5cblx0XHR2YXIgYm91bmRpbmdCb3g7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCAyOyBpKyspIHtcblx0XHRcdGJvdW5kaW5nQm94ID0gdGhpcy5fbGF5b3V0ZXIuZ2V0Qm91bmRpbmdCb3godGhpcy5fbm9kZXMscGFkZGluZyk7XG5cdFx0XHR2YXIgeFJhdGlvID0gdGhpcy5fc2NlbmUud2lkdGggLyBib3VuZGluZ0JveC53aWR0aDtcblx0XHRcdHZhciB5UmF0aW8gPSB0aGlzLl9zY2VuZS5oZWlnaHQgLyBib3VuZGluZ0JveC5oZWlnaHQ7XG5cdFx0XHR0aGlzLl96b29tKE1hdGgubWluKHhSYXRpbywgeVJhdGlvKSwgMCwgMCk7XG5cdFx0fVxuXG5cdFx0dmFyIG1pZFNjcmVlblggPSB0aGlzLl9zY2VuZS53aWR0aCAvIDI7XG5cdFx0dmFyIG1pZFNjcmVlblkgPSB0aGlzLl9zY2VuZS5oZWlnaHQgLyAyO1xuXHRcdGJvdW5kaW5nQm94ID0gdGhpcy5fbGF5b3V0ZXIuZ2V0Qm91bmRpbmdCb3godGhpcy5fbm9kZXMpO1xuXHRcdHZhciBtaWRCQlggPSBib3VuZGluZ0JveC54ICsgYm91bmRpbmdCb3gud2lkdGggLyAyO1xuXHRcdHZhciBtaWRCQlkgPSBib3VuZGluZ0JveC55ICsgYm91bmRpbmdCb3guaGVpZ2h0IC8gMjtcblx0XHR0aGlzLl9wYW4oLShtaWRCQlgtbWlkU2NyZWVuWCksLShtaWRCQlktbWlkU2NyZWVuWSkpO1xuXG5cdFx0dGhpcy5fem9vbVNjYWxlID0gMS4wO1xuXHRcdHRoaXMuX2xheW91dGVyLl96b29tU2NhbGUgPSAxLjA7XG5cdFx0Ly8gWm9vbSB0aGUgcmVuZGVyIGdyb3Vwc1xuXHRcdC8vaWYgKHRoaXMuX3ByZXJlbmRlckdyb3VwKSB7XG5cdFx0Ly9cdHRoaXMuX3ByZXJlbmRlckdyb3VwLnNjYWxlWCA9IHRoaXMuX3pvb21TY2FsZTtcblx0XHQvL1x0dGhpcy5fcHJlcmVuZGVyR3JvdXAuc2NhbGVZID0gdGhpcy5fem9vbVNjYWxlO1xuXHRcdC8vfVxuXHRcdC8vaWYgKHRoaXMuX3Bvc3RyZW5kZXJHcm91cCkge1xuXHRcdC8vXHR0aGlzLl9wb3N0cmVuZGVyR3JvdXAuc2NhbGVYID0gdGhpcy5fem9vbVNjYWxlO1xuXHRcdC8vXHR0aGlzLl9wb3N0cmVuZGVyR3JvdXAuc2NhbGVZID0gdGhpcy5fem9vbVNjYWxlO1xuXHRcdC8vfVxuXHRcdHRoaXMudXBkYXRlKCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogU3VzcGVuZCBtb3VzZSBldmVudHMgYW5kIHpvb21pbmdcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9zdXNwZW5kRXZlbnRzIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5fbGF5b3V0ZXIuX2V2ZW50c1N1c3BlbmRlZCA9IHRydWU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIHJlc3VtZSBtb3VzZSBldmVudHMgYW5kIHpvb21pbmdcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9yZXN1bWVFdmVudHMgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9sYXlvdXRlci5fZXZlbnRzU3VzcGVuZGVkID0gZmFsc2U7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFF1ZXJ5IGV2ZW50IHN1c3BlbnNpb24gc3RhdHVzXG5cdCAqIEByZXR1cm5zIGJvb2xlYW5cblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9ldmVudHNTdXNwZW5kZWQgOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0ZXIuX2V2ZW50c1N1c3BlbmRlZDtcblx0fSxcblxuXHQvKipcblx0ICogUmVtb3ZlcyBhbGwgcmVuZGVyIG9iamVjdHMgYXNzb2NpYXRlZCB3aXRoIGEgZ3JhcGguXG5cdCAqL1xuXHRjbGVhciA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByZW1vdmVSZW5kZXJPYmplY3RzID0gZnVuY3Rpb24oaW5kZXhUb09iamVjdCkge1xuXHRcdFx0Zm9yICh2YXIga2V5IGluIGluZGV4VG9PYmplY3QpIHtcblx0XHRcdFx0aWYgKGluZGV4VG9PYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdHZhciBvYmogPSBpbmRleFRvT2JqZWN0W2tleV07XG5cdFx0XHRcdFx0aWYgKCQuaXNBcnJheShvYmopKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZChvYmpbaV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZChvYmopO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkZWxldGUgaW5kZXhUb09iamVjdFtrZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZW1vdmVSZW5kZXJPYmplY3RzLmNhbGwodGhpcyx0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZSk7XG5cdFx0cmVtb3ZlUmVuZGVyT2JqZWN0cy5jYWxsKHRoaXMsdGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSk7XG5cdFx0cmVtb3ZlUmVuZGVyT2JqZWN0cy5jYWxsKHRoaXMsdGhpcy5fbm9kZUluZGV4VG9MYWJlbCk7XG5cdFx0aWYgKHRoaXMuX3ByZXJlbmRlckdyb3VwKSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0aGlzLl9wcmVyZW5kZXJHcm91cCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9oYW5kbGVHcm91cCkge1xuXHRcdFx0dGhpcy5fc2NlbmUucmVtb3ZlQ2hpbGQodGhpcy5faGFuZGxlR3JvdXApO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fcG9zdHJlbmRlckdyb3VwKSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0aGlzLl9wb3N0cmVuZGVyR3JvdXApO1xuXHRcdH1cblx0XHR0aGlzLl9zY2VuZS51cGRhdGUoKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHR0b0ltYWdlVVJJIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGQgPSBuZXcgJC5EZWZlcnJlZCgpO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR2YXIgb3JpZ2luYWxEdXJhdGlvbiA9IHRoaXMuX2xheW91dGVyLl9kdXJhdGlvbjtcblx0XHR0aGlzLl9sYXlvdXRlci5fZHVyYXRpb24gPSAxO1xuXG5cdFx0dmFyIGNhcHR1cmVDYW52YXMgPSAkKCc8Y2FudmFzLz4nKS5hcHBlbmRUbygkKGRvY3VtZW50LmJvZHkpKTtcblxuXHRcdHZhciBvbkxheW91dEZpbmlzaGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRjYXB0dXJlR3JhcGguX2xheW91dGVyLnBvc3RyZW5kZXJVcGRhdGUoKTtcblx0XHRcdHZhciBwYWRkaW5nID0gMTUwO1xuXHRcdFx0dmFyIGJvdW5kaW5nQm94ID0gY2FwdHVyZUdyYXBoLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveChjYXB0dXJlR3JhcGgubm9kZXMoKSwwLHRydWUpO1xuXHRcdFx0Y2FwdHVyZUdyYXBoLnJlc2l6ZShib3VuZGluZ0JveC53aWR0aCtwYWRkaW5nLGJvdW5kaW5nQm94LmhlaWdodCtwYWRkaW5nKTtcblx0XHRcdGNhcHR1cmVHcmFwaC5fcGFuKC1ib3VuZGluZ0JveC54KyhwYWRkaW5nLzIpLC1ib3VuZGluZ0JveC55ICsgKHBhZGRpbmcvMikpO1xuXG5cdFx0XHR2YXIgdXJpID0gY2FwdHVyZUNhbnZhc1swXS50b0RhdGFVUkwoKTtcblx0XHRcdGNhcHR1cmVDYW52YXMucmVtb3ZlKCk7XG5cblx0XHRcdHRoYXQuX2xheW91dGVyLl9zY2VuZS5pc0V4cG9ydCA9IGZhbHNlO1xuXHRcdFx0dGhhdC5jbGVhcigpXG5cdFx0XHRcdC5ub2Rlcyh0aGF0Ll9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZE5vZGVzKCkpXG5cdFx0XHRcdC5saW5rcyh0aGF0Ll9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZExpbmtzKCkpXG5cdFx0XHRcdC5kcmF3KCk7XG5cblx0XHRcdHRoYXQuX2xheW91dGVyLl9hcHBseVpvb21TY2FsZSh0cnVlKTtcblx0XHRcdHRoYXQubGF5b3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGF0Ll9sYXlvdXRlci5fZHVyYXRpb24gPSBvcmlnaW5hbER1cmF0aW9uO1xuXHRcdFx0XHRkLnJlc29sdmUodXJpKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhhdC5fbGF5b3V0ZXIuX2FwcGx5Wm9vbVNjYWxlKGZhbHNlKTtcblx0XHR9O1xuXG5cdFx0dmFyIGNhcHR1cmVHcmFwaCA9IG5ldyBHcmFwaCgpXG5cdFx0XHQuY2FudmFzKGNhcHR1cmVDYW52YXNbMF0pXG5cdFx0XHQubm9kZXModGhpcy5ub2RlcygpKVxuXHRcdFx0LmxheW91dGVyKHRoaXMuX2xheW91dGVyKVxuXHRcdFx0LmxpbmtzKHRoaXMubGlua3MoKSlcblx0XHRcdC5mb250Q29sb3VyKHRoaXMuX2ZvbnRDb2xvcilcblx0XHRcdC5mb250RmFtaWx5KHRoaXMuX2ZvbnRGYW1pbHkpXG5cdFx0XHQuZm9udFNpemUodGhpcy5fZm9udFNpemUpO1xuXG5cdFx0dmFyIGZzID0gdGhpcy5mb250U2hhZG93KCk7XG5cdFx0aWYgKGZzKSB7XG5cdFx0XHRjYXB0dXJlR3JhcGguZm9udFNoYWRvdyhmcy5jb2xvciwgZnMub2Zmc2V0WCwgZnMub2Zmc2V0WSwgZnMuYmx1cik7XG5cdFx0fVxuXHRcdGNhcHR1cmVHcmFwaC5kcmF3KCk7XG5cblx0XHRjYXB0dXJlR3JhcGguX3NjZW5lLmlzRXhwb3J0ID0gdHJ1ZTtcblxuXHRcdGlmICh0aGlzLl9zaG93QWxsTGFiZWxzKSB7XG5cdFx0XHRmb3IgKHZhciBuSWR4IGluIHRoaXMuX25vZGVJbmRleFRvTGFiZWwpIHtcblx0XHRcdFx0aWYgKHRoaXMuX25vZGVJbmRleFRvTGFiZWwuaGFzT3duUHJvcGVydHkobklkeCkpIHtcblx0XHRcdFx0XHRjYXB0dXJlR3JhcGguYWRkTGFiZWwodGhpcy5ub2RlV2l0aEluZGV4KG5JZHgpLHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbklkeF0udGV4dCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y2FwdHVyZUdyYXBoLmxheW91dChvbkxheW91dEZpbmlzaGVkKTtcblxuXHRcdHJldHVybiBkLnByb21pc2UoKTtcblx0fVxufSk7XG5cblxuZXhwb3J0cy5MSU5LX1RZUEUgPSByZXF1aXJlKCcuL2xpbmtUeXBlJyk7XG5leHBvcnRzLkdyb3VwaW5nTWFuYWdlciA9IHJlcXVpcmUoJy4vZ3JvdXBpbmdNYW5hZ2VyJyk7XG5leHBvcnRzLkxheW91dCA9IHJlcXVpcmUoJy4vbGF5b3V0Jyk7XG5leHBvcnRzLkNvbHVtbkxheW91dCA9IHJlcXVpcmUoJy4vY29sdW1uTGF5b3V0Jyk7XG5leHBvcnRzLlJhZGlhbExheW91dCA9IHJlcXVpcmUoJy4vcmFkaWFsTGF5b3V0Jyk7XG5leHBvcnRzLkV4dGVuZCA9IF8uZXh0ZW5kO1xuZXhwb3J0cy5HcmFwaCA9IEdyYXBoOyIsInZhciBfID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgTGF5b3V0ID0gcmVxdWlyZSgnLi9sYXlvdXQnKTtcbi8qKlxuICpcbiAqIEBwYXJhbSBmb2N1cyAtIHRoZSBub2RlIGF0IHRoZSBjZW50ZXIgb2YgdGhlIHJhZGlhbCBsYXlvdXRcbiAqIEBwYXJhbSBkaXN0YW5jZSAtIHRoZSBkaXN0YW5jZSBvZiBvdGhlciBub2RlcyBmcm9tIHRoZSBmb2N1c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJhZGlhbExheW91dChmb2N1cyxkaXN0YW5jZSkge1xuXHR0aGlzLl9mb2N1cyA9IGZvY3VzO1xuXHR0aGlzLl9kaXN0YW5jZSA9IGRpc3RhbmNlO1xuXG5cdExheW91dC5hcHBseSh0aGlzKTtcbn1cblxuXG5SYWRpYWxMYXlvdXQucHJvdG90eXBlID0gXy5leHRlbmQoUmFkaWFsTGF5b3V0LnByb3RvdHlwZSwgTGF5b3V0LnByb3RvdHlwZSwge1xuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBkaXN0YW5jZSBwYXJhbWV0ZXJcblx0ICogQHBhcmFtIGRpc3RhbmNlIC0gdGhlIGRpc3RhbmNlIG9mIGxpbmtzIGZyb20gdGhlIGZvY3VzIG5vZGUgdG8gb3RoZXIgbm9kZXMgaW4gcGl4ZWxzXG5cdCAqIEByZXR1cm5zIHtSYWRpYWxMYXlvdXR9IGlmIGRpc3RhbmNlIHBhcmFtIGlzIGRlZmluZWQsIHtSYWRpYWxMYXlvdXQuX2Rpc3RhbmNlfSBvdGhlcndpc2Vcblx0ICovXG5cdGRpc3RhbmNlOiBmdW5jdGlvbiAoZGlzdGFuY2UpIHtcblx0XHRpZiAoZGlzdGFuY2UpIHtcblx0XHRcdHRoaXMuX2Rpc3RhbmNlID0gZGlzdGFuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9kaXN0YW5jZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9jdXMgbm9kZSB0aGF0IGlzIGF0IHRoZSBjZW50ZXIgb2YgdGhlIGxheW91dFxuXHQgKiBAcGFyYW0gZm9jdXMgLSB0aGUgbm9kZSB0aGF0IGlzIGF0IHRoZSBjZW50ZXIgb2YgdGhlIGxheW91dC4gICBPdGhlciBub2RlcyBhcmUgY2VudGVyZWQgYXJvdW5kIHRoaXMuXG5cdCAqIEByZXR1cm5zIHtSYWRpYWxMYXlvdXR9IGlmIGZvY3VzIHBhcmFtIGlzIGRlZmluZWQsIHtSYWRpYWxMYXlvdXQuX2ZvY3VzfSBvdGhlcndpc2Vcblx0ICovXG5cdGZvY3VzOiBmdW5jdGlvbiAoZm9jdXMpIHtcblx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdHRoaXMuX2ZvY3VzID0gZm9jdXM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb2N1cztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCB0aGUgbGFiZWwgcG9zaXRpb24gZm9yIGEgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVggLSB0aGUgeCBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gbm9kZVkgLSB0aGUgeSBwb3NpdGlvbiBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gcmFkaXVzIC0gdGhlIHJhZGl1cyBvZiB0aGUgbm9kZVxuXHQgKiBAcmV0dXJucyB7e3g6IHggcG9zaXRpb24gb2YgdGhlIGxhYmVsLCB5OiB5IHBvc2l0aW9uIG9mIHRoZSBsYWJlbCwgYWxpZ246IEhUTUwgY2FudmFzIHRleHQgYWxpZ25tZW50IHByb3BlcnR5IGZvciBsYWJlbH19XG5cdCAqL1xuXHRsYXlvdXRMYWJlbDogZnVuY3Rpb24gKG5vZGVYLCBub2RlWSwgcmFkaXVzKSB7XG5cdFx0dmFyIHgsIHksIGFsaWduO1xuXG5cdFx0Ly8gUmlnaHQgb2YgY2VudGVyXG5cdFx0aWYgKG5vZGVYID4gdGhpcy5fZm9jdXMpIHtcblx0XHRcdHggPSBub2RlWCArIChyYWRpdXMgKyAxMCk7XG5cdFx0XHRhbGlnbiA9ICdzdGFydCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHggPSBub2RlWCAtIChyYWRpdXMgKyAxMCk7XG5cdFx0XHRhbGlnbiA9ICdlbmQnO1xuXHRcdH1cblxuXHRcdGlmIChub2RlWSA+IHRoaXMuX2ZvY3VzKSB7XG5cdFx0XHR5ID0gbm9kZVkgKyAocmFkaXVzICsgMTApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR5ID0gbm9kZVkgLSAocmFkaXVzICsgMTApO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0eDogeCxcblx0XHRcdHk6IHksXG5cdFx0XHRhbGlnbjogYWxpZ25cblx0XHR9O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBQZXJmb3JtIGEgcmFkaWFsIGxheW91dFxuXHQgKiBAcGFyYW0gdyAtIHRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIGJlaW5nIHJlbmRlcmVkIHRvXG5cdCAqIEBwYXJhbSBoIC0gdGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIGJlaW5nIHJlbmRlcmVkIHRvXG5cdCAqL1xuXHRsYXlvdXQ6IGZ1bmN0aW9uICh3LCBoKSB7XG5cdFx0dmFyIG5vZGVzID0gdGhpcy5ub2RlcygpO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR2YXIgYW5nbGVEZWx0YSA9IE1hdGguUEkgKiAyIC8gKG5vZGVzLmxlbmd0aCAtIDEpO1xuXHRcdHZhciBhbmdsZSA9IDAuMDtcblx0XHRub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG5cdFx0XHRpZiAobm9kZS5pbmRleCA9PT0gdGhhdC5fZm9jdXMuaW5kZXgpIHtcblx0XHRcdFx0dGhhdC5fc2V0Tm9kZVBvc2l0aW9uKG5vZGUsIG5vZGUueCwgbm9kZS55KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIG5ld1ggPSB0aGF0Ll9mb2N1cy54ICsgKE1hdGguY29zKGFuZ2xlKSAqIHRoYXQuX2Rpc3RhbmNlKTtcblx0XHRcdHZhciBuZXdZID0gdGhhdC5fZm9jdXMueSArIChNYXRoLnNpbihhbmdsZSkgKiB0aGF0Ll9kaXN0YW5jZSk7XG5cdFx0XHR0aGF0Ll9zZXROb2RlUG9zaXRpb24obm9kZSwgbmV3WCwgbmV3WSk7XG5cdFx0XHRhbmdsZSArPSBhbmdsZURlbHRhO1xuXHRcdH0pO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSYWRpYWxMYXlvdXQ7XG4iLCJcbnZhciBVdGlsID0ge1xuXG4gIGV4dGVuZDogZnVuY3Rpb24oZGVzdCwgc291cmNlcykge1xuICAgIHZhciBrZXksIGksIHNvdXJjZTtcbiAgICBmb3IgKGk9MTsgaTxhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoa2V5IGluIHNvdXJjZSkge1xuICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICBkZXN0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVzdDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVdGlsOyJdfQ==
(5)
});
