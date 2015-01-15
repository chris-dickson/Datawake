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

	/**
	 * Returns a bounding box for an array of node indices
	 * @param nodeOrIndexArray - array of node indicies or node array itself
	 * @param padding - padding in pixels applied to bounding box
	 * @returns {{min: {x: Number, y: Number}, max: {x: number, y: number}}}
	 */
	getBoundingBox : function(nodeOrIndexArray,padding) {
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
				.labelMap(this._nodeIndexToLabel);
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
		}
		if (!this._layouter) {
			var defaulLayout = new Layout()
				.nodes(this._nodes)
				.nodeMap(this._nodeIndexToCircle)
				.linkMap(this._nodeIndexToLinkLine)
				.labelMap(this._nodeIndexToLabel);
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
		var boundingBox = this._layouter.getBoundingBox(this._nodes);
		if (this._bbRender) {
			this._scene.removeChild(this._bbRender);
		}
		this._bbRender = path.rect({
			x : boundingBox.x,
			y : boundingBox.y,
			width : boundingBox.width,
			height : boundingBox.height,
			strokeStyle : '#ff0000',
			lineWidth : 2
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

		if (this._groupingManager) {
			this._groupingManager.clear();
		}

		return this;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2NvbHVtbkxheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2dyb3VwaW5nTWFuYWdlci5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2xheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL2xpbmtUeXBlLmpzIiwiL1VzZXJzL2NkaWNrc29uL0RvY3VtZW50cy93b3Jrc3BhY2UvZ3JhcGhqcy9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL3JhZGlhbExheW91dC5qcyIsIi9Vc2Vycy9jZGlja3Nvbi9Eb2N1bWVudHMvd29ya3NwYWNlL2dyYXBoanMvc3JjL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25XQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6b0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIExheW91dCA9IHJlcXVpcmUoJy4vbGF5b3V0Jyk7XG5cbnZhciBDb2x1bW5MYXlvdXQgPSBmdW5jdGlvbigpIHtcblx0TGF5b3V0LmFwcGx5KHRoaXMpO1xufTtcblxuQ29sdW1uTGF5b3V0LnByb3RvdHlwZSA9IF8uZXh0ZW5kKENvbHVtbkxheW91dC5wcm90b3R5cGUsIExheW91dC5wcm90b3R5cGUsIHtcblxuXHQvKipcblx0ICogQSBjb2x1bW4gbGF5b3V0XG5cdCAqIEBwYXJhbSB3IC0gd2lkdGggb2YgY2FudmFzXG5cdCAqIEBwYXJhbSBoIC0gaGVpZ2h0IG9mIGNhbnZhc1xuXHQgKi9cblx0bGF5b3V0IDogZnVuY3Rpb24gKHcsIGgpIHtcblx0XHR2YXIgeCA9IDA7XG5cdFx0dmFyIHkgPSAwO1xuXHRcdHZhciBtYXhSYWRpdXNDb2wgPSAwO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG5cblx0XHRcdGlmICh5ID09PSAwKSB7XG5cdFx0XHRcdHkgKz0gbm9kZS5yYWRpdXM7XG5cdFx0XHR9XG5cdFx0XHRpZiAoeCA9PT0gMCkge1xuXHRcdFx0XHR4ICs9IG5vZGUucmFkaXVzO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGF0Ll9zZXROb2RlUG9zaXRpb25JbW1lZGlhdGUobm9kZSwgeCwgeSk7XG5cblx0XHRcdG1heFJhZGl1c0NvbCA9IE1hdGgubWF4KG1heFJhZGl1c0NvbCwgbm9kZS5yYWRpdXMpO1xuXG5cdFx0XHR5ICs9IG5vZGUucmFkaXVzICsgNDA7XG5cdFx0XHRpZiAoeSA+IGgpIHtcblx0XHRcdFx0eSA9IDA7XG5cdFx0XHRcdHggKz0gbWF4UmFkaXVzQ29sICsgNDA7XG5cdFx0XHRcdG1heFJhZGl1c0NvbCA9IDA7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbHVtbkxheW91dDtcbiIsInZhciBfID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGJhc2UgZ3JvdXBpbmcgbWFuYWdlci4gICBUaGlzIGlzIGFuIGFic3RyYWN0IGNsYXNzLiAgIENoaWxkIGNsYXNzZXMgc2hvdWxkIG92ZXJyaWRlIHRoZVxuICogaW5pdGlhbGl6ZUhlaXJhcmNoeSBmdW5jdGlvbiB0byBjcmVhdGUgbm9kZXMvbGlua3MgdGhhdCBhcmUgYWdncmVnYXRlZCBmb3IgdGhlaXIgc3BlY2lmaWMgaW1wbGVtZW50YXRpb25cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgR3JvdXBpbmdNYW5hZ2VyID0gZnVuY3Rpb24oYXR0cmlidXRlcykge1xuXHR0aGlzLl9pbml0aWFsaXplKCk7XG5cdF8uZXh0ZW5kKHRoaXMsYXR0cmlidXRlcyk7XG59O1xuXG5Hcm91cGluZ01hbmFnZXIucHJvdG90eXBlID0gXy5leHRlbmQoR3JvdXBpbmdNYW5hZ2VyLnByb3RvdHlwZSwge1xuXHRfaW5pdGlhbGl6ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX25vZGVzID0gW107XG5cdFx0dGhpcy5fbGlua3MgPSBbXTtcblxuXHRcdHRoaXMuX2FnZ3JlZ2F0ZWROb2RlcyA9IFtdO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZWRMaW5rcyA9IFtdO1xuXHRcdHRoaXMuX2FnZ3JlZ2F0ZU5vZGVNYXAgPSB7fTtcblxuXHRcdHRoaXMuX3VuZ3JvdXBlZEFnZ3JlZ2F0ZXMgPSB7fTtcblx0XHR0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzID0ge307XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlc2V0IGhlaXJhcmNoeVxuXHQgKi9cblx0Y2xlYXIgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9pbml0aWFsaXplKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgb3JpZ2luYWwgbm9kZXMgaW4gdGhlIGdyYXBoIHdpdGhvdXQgZ3JvdXBpbmdcblx0ICogQHBhcmFtIG5vZGVzIC0gYSBncmFwaC5qcyBub2RlIGFycmF5XG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0bm9kZXMgOiBmdW5jdGlvbihub2Rlcykge1xuXHRcdGlmIChub2Rlcykge1xuXHRcdFx0dGhpcy5fbm9kZXMgPSBub2Rlcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX25vZGVzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBvcmlnaW5hbCBsaW5rcyBpbiB0aGUgZ3JhcGggd2l0aG91dCBncm91cGluZ1xuXHQgKiBAcGFyYW0gbGlua3MgLSBhIGdyYXBoLmpzIGxpbmsgYXJyYXlcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRsaW5rcyA6IGZ1bmN0aW9uKGxpbmtzKSB7XG5cdFx0aWYgKGxpbmtzKSB7XG5cdFx0XHR0aGlzLl9saW5rcyA9IGxpbmtzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGlua3M7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0aGUgbm9kZS9saW5rIGFnZ3JlZ2F0aW9uXG5cdCAqL1xuXHRpbml0aWFsaXplSGVpcmFyY2h5IDogZnVuY3Rpb24oKSB7XG5cblx0XHR0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzID0ge307XG5cdFx0dGhpcy5fdW5ncm91cGVkTm9kZUdyb3VwcyA9IHt9O1xuXG5cdFx0dGhpcy5fYWdncmVnYXRlTm9kZXMoKTtcblx0XHR0aGlzLl9hZ2dyZWdhdGVMaW5rcygpO1xuXG5cdFx0dmFyIHNldFBhcmVudFBvaW50ZXJzID0gZnVuY3Rpb24obm9kZSxwYXJlbnQpIHtcblx0XHRcdGlmIChub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdG5vZGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuXHRcdFx0XHRcdHNldFBhcmVudFBvaW50ZXJzKGNoaWxkLG5vZGUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdG5vZGUucGFyZW50Tm9kZSA9IHBhcmVudDtcblx0XHR9O1xuXG5cdFx0dGhpcy5fYWdncmVnYXRlZE5vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0c2V0UGFyZW50UG9pbnRlcnMobm9kZSxudWxsKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLm9uQWdncmVnYXRpb25Db21wbGV0ZSkge1xuXHRcdFx0dGhpcy5vbkFnZ3JlZ2F0aW9uQ29tcGxldGUoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4gYWdncmVnYXRlZCBsaW5rIGluIGdyYXBoLmpzIGZvcm1hdC4gICBDYW4gYmUgb3ZlcnJpZGVuIGJ5IHNwZWNpZmljIGltcGxlbWVudGF0aW9ucyB0byBhbGxvd1xuXHQgKiB0byBhbGxvdyBmb3IgZGlmZXJlbnQgbGluayB0eXBlcyBiYXNlZCBvbiBhZ2dyZWdhdGUgY29udGVudHNcblx0ICogQHBhcmFtIHNvdXJjZUFnZ3JlZ2F0ZSAtIHRoZSBzb3VyY2UgYWdncmVnYXRlIG5vZGVcblx0ICogQHBhcmFtIHRhcmdldEFnZ3JlZ2F0ZSAtIHRoZSB0YXJnZXQgYWdncmVnYXRlIG5vZGVcblx0ICogQHJldHVybnMge3tzb3VyY2U6ICosIHRhcmdldDogKn19IC0gYSBncmFwaC5qcyBsaW5rXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfY3JlYXRlQWdncmVnYXRlTGluayA6IGZ1bmN0aW9uKHNvdXJjZUFnZ3JlZ2F0ZSx0YXJnZXRBZ2dyZWdhdGUsb3JpZ2luYWxMaW5rcykge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzb3VyY2UgOiBzb3VyY2VBZ2dyZWdhdGUsXG5cdFx0XHR0YXJnZXQgOiB0YXJnZXRBZ2dyZWdhdGVcblx0XHR9O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBQZXJmb3JtcyBsaW5rIGFnZ3JlZ2F0ZSBiYXNlZCBvbiBhIHNldCBvZiBhZ2dyZWdhdGVkIG5vZGVzIGFuZCBhIGZ1bGwgc2V0IG9mIGxpbmtzXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfYWdncmVnYXRlTGlua3MgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZSA9IHt9O1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuZm9yRWFjaChmdW5jdGlvbihhZ2dyZWdhdGUpIHtcblx0XHRcdGlmIChhZ2dyZWdhdGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0YWdncmVnYXRlLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHRcdG5vZGVJbmRleFRvQWdncmVhZ2F0ZU5vZGVbbm9kZS5pbmRleF0gPSBhZ2dyZWdhdGU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVthZ2dyZWdhdGUuaW5kZXhdID0gYWdncmVnYXRlO1xuXHRcdFx0fVxuXHRcdFx0dGhhdC5fYWdncmVnYXRlTm9kZU1hcFthZ2dyZWdhdGUuaW5kZXhdID0gYWdncmVnYXRlO1xuXHRcdH0pO1xuXG5cblx0XHR2YXIgYWdncmVnYXRlZExpbmtzID0gW107XG5cblx0XHR2YXIgYWdncmVnYXRlTGlua01hcCA9IHt9O1xuXG5cdFx0dGhpcy5fbGlua3MuZm9yRWFjaChmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHR2YXIgc291cmNlQWdncmVnYXRlID0gbm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVtsaW5rLnNvdXJjZS5pbmRleF07XG5cdFx0XHR2YXIgdGFyZ2V0QWdncmVnYXRlID0gbm9kZUluZGV4VG9BZ2dyZWFnYXRlTm9kZVtsaW5rLnRhcmdldC5pbmRleF07XG5cblx0XHRcdGlmICghc291cmNlQWdncmVnYXRlIHx8ICF0YXJnZXRBZ2dyZWdhdGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgc291cmNlTWFwID0gYWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGUuaW5kZXhdO1xuXHRcdFx0aWYgKCFzb3VyY2VNYXApIHtcblx0XHRcdFx0c291cmNlTWFwID0ge307XG5cdFx0XHR9XG5cdFx0XHR2YXIgc291cmNlVG9UYXJnZXRMaW5rcyA9IHNvdXJjZU1hcFt0YXJnZXRBZ2dyZWdhdGUuaW5kZXhdO1xuXHRcdFx0aWYgKCFzb3VyY2VUb1RhcmdldExpbmtzKSB7XG5cdFx0XHRcdHNvdXJjZVRvVGFyZ2V0TGlua3MgPSBbXTtcblx0XHRcdH1cblx0XHRcdHNvdXJjZVRvVGFyZ2V0TGlua3MucHVzaChsaW5rKTtcblx0XHRcdHNvdXJjZU1hcFt0YXJnZXRBZ2dyZWdhdGUuaW5kZXhdID0gc291cmNlVG9UYXJnZXRMaW5rcztcblxuXHRcdFx0YWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGUuaW5kZXhdID0gc291cmNlTWFwO1xuXHRcdH0pO1xuXG5cdFx0Ly8gR2V0IG1pbi9tYXggbGluayBjb3VudHMgZm9yIGFsbCBhZ2dyZWdhdGUgcGFpcnNcblx0XHR2YXIgbWluQ291bnQgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXHRcdHZhciBtYXhDb3VudCA9IDA7XG5cdFx0Zm9yICh2YXIgc291cmNlQWdncmVnYXRlSWQgaW4gYWdncmVnYXRlTGlua01hcCkge1xuXHRcdFx0aWYgKGFnZ3JlZ2F0ZUxpbmtNYXAuaGFzT3duUHJvcGVydHkoc291cmNlQWdncmVnYXRlSWQpKSB7XG5cdFx0XHRcdGZvciAodmFyIHRhcmdldEFnZ3JlZ2F0ZUlkIGluIGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdKSB7XG5cdFx0XHRcdFx0aWYgKGFnZ3JlZ2F0ZUxpbmtNYXBbc291cmNlQWdncmVnYXRlSWRdLmhhc093blByb3BlcnR5KHRhcmdldEFnZ3JlZ2F0ZUlkKSkge1xuXHRcdFx0XHRcdFx0dmFyIHNvdXJjZSA9IHRoYXQuX2FnZ3JlZ2F0ZU5vZGVNYXBbc291cmNlQWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIHRhcmdldCA9IHRoYXQuX2FnZ3JlZ2F0ZU5vZGVNYXBbdGFyZ2V0QWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIG9yaWdpbmFsTGlua3MgPSBhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXVt0YXJnZXRBZ2dyZWdhdGVJZF07XG5cdFx0XHRcdFx0XHRtaW5Db3VudCA9IE1hdGgubWluKG1pbkNvdW50LG9yaWdpbmFsTGlua3MubGVuZ3RoKTtcblx0XHRcdFx0XHRcdG1heENvdW50ID0gTWF0aC5tYXgobWF4Q291bnQsb3JpZ2luYWxMaW5rcy5sZW5ndGgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAodmFyIHNvdXJjZUFnZ3JlZ2F0ZUlkIGluIGFnZ3JlZ2F0ZUxpbmtNYXApIHtcblx0XHRcdGlmIChhZ2dyZWdhdGVMaW5rTWFwLmhhc093blByb3BlcnR5KHNvdXJjZUFnZ3JlZ2F0ZUlkKSkge1xuXHRcdFx0XHRmb3IgKHZhciB0YXJnZXRBZ2dyZWdhdGVJZCBpbiBhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXSkge1xuXHRcdFx0XHRcdGlmIChhZ2dyZWdhdGVMaW5rTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXS5oYXNPd25Qcm9wZXJ0eSh0YXJnZXRBZ2dyZWdhdGVJZCkpIHtcblx0XHRcdFx0XHRcdHZhciBzb3VyY2UgPSB0aGF0Ll9hZ2dyZWdhdGVOb2RlTWFwW3NvdXJjZUFnZ3JlZ2F0ZUlkXTtcblx0XHRcdFx0XHRcdHZhciB0YXJnZXQgPSB0aGF0Ll9hZ2dyZWdhdGVOb2RlTWFwW3RhcmdldEFnZ3JlZ2F0ZUlkXTtcblx0XHRcdFx0XHRcdHZhciBvcmlnaW5hbExpbmtzID0gYWdncmVnYXRlTGlua01hcFtzb3VyY2VBZ2dyZWdhdGVJZF1bdGFyZ2V0QWdncmVnYXRlSWRdO1xuXHRcdFx0XHRcdFx0dmFyIGxpbmsgPSB0aGF0Ll9jcmVhdGVBZ2dyZWdhdGVMaW5rKHNvdXJjZSwgdGFyZ2V0LCBvcmlnaW5hbExpbmtzLCBtaW5Db3VudCwgbWF4Q291bnQpO1xuXHRcdFx0XHRcdFx0aWYgKGxpbmspIHtcblx0XHRcdFx0XHRcdFx0YWdncmVnYXRlZExpbmtzLnB1c2gobGluayk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWdncmVnYXRlZExpbmtzID0gYWdncmVnYXRlZExpbmtzO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFBlcmZvcm0gbm9kZSBhZ2dyZWdhdGlvbi4gICBNdXN0IGJlIG92ZXJyaWRlbiBieSBpbXBsZW1lbnRvcnNcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9hZ2dyZWdhdGVOb2RlcyA6IGZ1bmN0aW9uKCkge1xuXG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGFnZ3JlZ2F0ZWQgbm9kZXNcblx0ICogQHJldHVybnMge0FycmF5fSBvZiBncmFwaC5qcyBub2Rlc1xuXHQgKi9cblx0YWdncmVnYXRlZE5vZGVzIDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcztcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgYWdncmVnYXRlZCBsaW5rc1xuXHQgKiBAcmV0dXJucyB7QXJyYXl9IG9mIGdyYXBoLmpzIGxpbmtzXG5cdCAqL1xuXHRhZ2dyZWdhdGVkTGlua3MgOiBmdW5jdGlvbigpICB7XG5cdFx0cmV0dXJuIHRoaXMuX2FnZ3JlZ2F0ZWRMaW5rcztcblx0fSxcblxuXHQvKipcblx0ICogUmVtb3ZlIGEgbm9kZSBmcm9tIHRoZSBoZXJpYXJjaHlcblx0ICogQHBhcmFtIG5vZGVcblx0ICovXG5cdHJlbW92ZSA6IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHR2YXIgaW5kZXggPSAtMTtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5sZW5ndGggJiYgaW5kZXggPT09IC0xOyBpKyspIHtcblx0XHRcdGlmICh0aGlzLl9hZ2dyZWdhdGVkTm9kZXNbaV0uaW5kZXggPT09IG5vZGUuaW5kZXgpIHtcblx0XHRcdFx0aW5kZXggPSBpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMuc3BsaWNlKGluZGV4LDEpO1xuXHRcdH1cblx0fSxcblxuXG5cdC8qKlxuXHQgKiBEbyBhbnkgdXBkYXRlcyBvbiBjaGlsZHJlbiBiZWZvcmUgbGF5b3V0ICAoaWUvIHNldCBwb3NpdGlvbiwgcm93L2NvbCBpbmZvLCBldGMpLiAgIFNob3VsZCBiZSBkZWZpbmVkXG5cdCAqIGluIGltcGxlbWVudGluZyBjbGFzc1xuXHQgKiBAcGFyYW0gYWdncmVnYXRlXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfdXBkYXRlQ2hpbGRyZW4gOiBmdW5jdGlvbihhZ2dyZWdhdGUpIHtcblx0XHQvLyBzZXQgY2hpbGRyZW5zIHBvc2l0aW9uIGluaXRpYWxseSB0byB0aGUgcG9zaXRpb24gb2YgdGhlIGFnZ3JlZ2F0ZVxuXHRcdGFnZ3JlZ2F0ZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG5cdFx0XHRjaGlsZC54ID0gYWdncmVnYXRlLng7XG5cdFx0XHRjaGlsZC55ID0gYWdncmVnYXRlLnk7XG5cdFx0fSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVuZ3JvdXAgYW4gYWdncmVnYXRlIG5vZGVcblx0ICogQHBhcmFtIG5vZGVcblx0ICovXG5cdHVuZ3JvdXAgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4pIHtcblxuXHRcdFx0dmFyIHBhcmVudEtleSA9ICcnO1xuXHRcdFx0bm9kZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdFx0cGFyZW50S2V5ICs9IG5vZGUuaW5kZXggKyAnLCc7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fdW5ncm91cGVkQWdncmVnYXRlc1twYXJlbnRLZXldID0gbm9kZTtcblxuXHRcdFx0dmFyIGluZGV4ID0gLTE7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5sZW5ndGggJiYgaW5kZXggPT09IC0xOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlc1tpXS5pbmRleCA9PT0gbm9kZS5pbmRleCkge1xuXHRcdFx0XHRcdGluZGV4ID0gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl91cGRhdGVDaGlsZHJlbihub2RlKTtcblxuXHRcdFx0dmFyIGZpcnN0ID0gdGhpcy5fYWdncmVnYXRlZE5vZGVzLnNsaWNlKDAsaW5kZXgpO1xuXHRcdFx0dmFyIG1pZGRsZSA9IG5vZGUuY2hpbGRyZW47XG5cdFx0XHR0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzW3BhcmVudEtleV0gPSBub2RlLmNoaWxkcmVuO1xuXHRcdFx0dmFyIGVuZCA9IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5zbGljZShpbmRleCsxKTtcblxuXHRcdFx0dGhpcy5fYWdncmVnYXRlZE5vZGVzID0gZmlyc3QuY29uY2F0KG1pZGRsZSkuY29uY2F0KGVuZCk7XG5cblx0XHRcdC8vIFJlY29tcHV0ZSBhZ2dyZWdhdGVkIGxpbmtzXG5cdFx0XHR0aGlzLl9hZ2dyZWdhdGVMaW5rcygpO1xuXHRcdFx0cmV0dXJuIHBhcmVudEtleTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGFnZ3JlZ2F0ZSBub2RlIGZvciBhbiBleHBhbmRlZCBncm91cFxuXHQgKiBAcGFyYW0gYWdncmVnYXRlS2V5IC0ga2V5IHJldHVybmVkIGZyb20gdW5ncm91cFxuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdGdldEFnZ3JlZ2F0ZSA6IGZ1bmN0aW9uKGFnZ3JlZ2F0ZUtleSkge1xuXHRcdHJldHVybiB0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzW2FnZ3JlZ2F0ZUtleV07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlZ3JvdXBzIGFuIHVuZ3JvdXBlZCBhZ2dyZWdhdGVcblx0ICogQHBhcmFtIGFnZ3JlZ2F0ZUtleSAtIGtleSByZXR1cm5lZCBmcm9tIHVuZ3JvdXBcblx0ICogQHBhcmFtIGF0SW5kZXggLSByZWluc2VydHMgdGhlIGFnZ3JlZ2F0ZSBhdCBhIHNwZWNpZmljIHBvc2l0aW9uXG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0cmVncm91cCA6IGZ1bmN0aW9uKGFnZ3JlZ2F0ZUtleSxhdEluZGV4KSB7XG5cdFx0dmFyIGFnZ3JlZ2F0ZU5vZGUgPSB0aGlzLl91bmdyb3VwZWRBZ2dyZWdhdGVzW2FnZ3JlZ2F0ZUtleV07XG5cdFx0dmFyIG5vZGVzVG9SZW1vdmUgPSBhZ2dyZWdhdGVOb2RlLmNoaWxkcmVuO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRub2Rlc1RvUmVtb3ZlLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0dGhhdC5yZW1vdmUobm9kZSk7XG5cdFx0fSk7XG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5fYWdncmVnYXRlZE5vZGVzLnNsaWNlKDAsYXRJbmRleCk7XG5cdFx0dmFyIGVuZCA9IHRoaXMuX2FnZ3JlZ2F0ZWROb2Rlcy5zbGljZShhdEluZGV4KTtcblx0XHR0aGlzLl9hZ2dyZWdhdGVkTm9kZXMgPSBzdGFydC5jb25jYXQoYWdncmVnYXRlTm9kZSkuY29uY2F0KGVuZCk7XG5cdFx0dGhpcy5fYWdncmVnYXRlTGlua3MoKTtcblx0XHRkZWxldGUgdGhpcy5fdW5ncm91cGVkQWdncmVnYXRlc1thZ2dyZWdhdGVLZXldO1xuXHRcdGRlbGV0ZSB0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzW2FnZ3JlZ2F0ZUtleV07XG5cdFx0cmV0dXJuIGFnZ3JlZ2F0ZU5vZGU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYW4gYXJyYXkgb2Ygbm9kZSBncm91cHMgdGhhdCBhcmUgZXhwYW5kZWRcblx0ICogQHJldHVybnMge0FycmF5fVxuXHQgKi9cblx0Z2V0VW5ncm91cGVkTm9kZXMgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgaW5mbyA9IFtdO1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRPYmplY3Qua2V5cyh0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0dmFyIG5vZGVzID0gdGhhdC5fdW5ncm91cGVkTm9kZUdyb3Vwc1trZXldO1xuXHRcdFx0dmFyIG5vZGVJbmRpY2VzID0gbm9kZXMubWFwKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGUuaW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdGluZm8ucHVzaCh7XG5cdFx0XHRcdGluZGljZXMgOiBub2RlSW5kaWNlcyxcblx0XHRcdFx0a2V5IDoga2V5XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRyZXR1cm4gaW5mbztcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyBhIGxpc3Qgb2YgdW5ncm91cGVkIG5vZGVzIGZvciBhbiBhZ2dyZWdhdGVcblx0ICogQHBhcmFtIGtleSAtIGtleSByZXR1cm5lZCBmcm9tIHVuZ3JvdXBcblx0ICogQHJldHVybnMgeyp9XG5cdCAqL1xuXHRnZXRVbmdyb3VwZWROb2Rlc0ZvcktleSA6IGZ1bmN0aW9uKGtleSkge1xuXHRcdHJldHVybiB0aGlzLl91bmdyb3VwZWROb2RlR3JvdXBzW2tleV07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHgseSBwb3NpdGlvbiAocmVsYXRpdmUgdG8gZ3JvdXAgYm91bmRpbmcgYm94KSBmb3IgdGhlXG5cdCAqIHJlZ3JvdXAgKG1pbmltaXplKSBpY29uXG5cdCAqIEBwYXJhbSBib3VuZGluZ0JveCAtIGJvdW5kaW5nIGJveCBvZiBub2Rlc1xuXHQgKiBAcGFyYW0gdW5ncm91cGVkTm9kZXMgLSBjb2xsZWN0aW9uIG9mIHVuZ3JvdXBlZCBub2Rlc1xuXHQgKiBAcmV0dXJucyB7e3g6ICosIHk6ICp9fVxuXHQgKi9cblx0Z2V0TWluaW1pemVJY29uUG9zaXRpb24gOiBmdW5jdGlvbihib3VuZGluZ0JveCx1bmdyb3VwZWROb2Rlcykge1xuXHRcdHJldHVybiB7XG5cdFx0XHR4IDogYm91bmRpbmdCb3gueCArIGJvdW5kaW5nQm94LndpZHRoICsgMTAsXG5cdFx0XHR5IDogYm91bmRpbmdCb3gueVxuXHRcdH07XG5cdH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gR3JvdXBpbmdNYW5hZ2VyO1xuIiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBMYXlvdXQgY29uc3RydWN0b3JcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgTGF5b3V0ID0gZnVuY3Rpb24oYXR0cmlidXRlcykge1xuXHR0aGlzLl9ub2RlcyA9IG51bGw7XG5cdHRoaXMuX2xpbmtNYXAgPSBudWxsO1xuXHR0aGlzLl9ub2RlTWFwID0gbnVsbDtcblx0dGhpcy5fbGFiZWxNYXAgPSBudWxsO1xuXHR0aGlzLl9kdXJhdGlvbiA9IDI1MDtcblx0dGhpcy5fZWFzaW5nID0gJ2Vhc2UtaW4tb3V0Jztcblx0dGhpcy5fem9vbVNjYWxlID0gMS4wO1xuXHR0aGlzLl9ldmVudHNTdXNwZW5kZWQgPSBmYWxzZTtcblx0Xy5leHRlbmQodGhpcyxhdHRyaWJ1dGVzKTtcbn07XG5cbkxheW91dC5wcm90b3R5cGUgPSBfLmV4dGVuZChMYXlvdXQucHJvdG90eXBlLCB7XG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZHVyYXRpb24gb2YgdGhlIGxheW91dCBhbmltYXRpb25cblx0ICogQHBhcmFtIGR1cmF0aW9uIC0gdGhlIGR1cmF0aW9uIG9mIHRoZSBsYXlvdXQgYW5pbWF0aW9uIGluIG1pbGxpc2Vjb25kcy4gIChkZWZhdWx0ID0gMjUwbXMpXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9IGlmIGR1cmF0aW9uIHBhcmFtIGlzIGRlZmluZWQsIHtMYXlvdXQuX2R1cmF0aW9ufSBvdGhlcndpc2Vcblx0ICovXG5cdGR1cmF0aW9uIDogZnVuY3Rpb24oZHVyYXRpb24pIHtcblx0XHRpZiAoZHVyYXRpb24pIHtcblx0XHRcdHRoaXMuX2R1cmF0aW9uID0gZHVyYXRpb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9kdXJhdGlvbjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZWFzaW5nIG9mIHRoZSBsYXlvdXQgYW5pbWF0aW9uXG5cdCAqIEBwYXJhbSBlYXNpbmcgLSB0aGUgZWFzaW5nIG9mIHRoZSBsYXlvdXQgYW5pbWF0aW9uIGluIG1pbGxpc2Vjb25kcy4gIChkZWZhdWx0ID0gJ2Vhc2UtaW4tb3V0Jylcblx0ICogQHJldHVybnMge0xheW91dH0gaWYgZWFzaW5nIHBhcmFtIGlzIGRlZmluZWQsIHtMYXlvdXQuX2Vhc2luZ30gb3RoZXJ3aXNlXG5cdCAqL1xuXHRlYXNpbmcgOiBmdW5jdGlvbihlYXNpbmcpIHtcblx0XHRpZiAoZWFzaW5nKSB7XG5cdFx0XHR0aGlzLl9lYXNpbmcgPSBlYXNpbmc7XG5cdFx0fVx0IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2Vhc2luZztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbm9kZXMgb2YgdGhlIGxheW91dC4gICBTZXQgZnJvbSB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIG5vZGVzIC0gdGhlIHNldCBvZiBub2RlcyBkZWZpbmVkIGluIHRoZSBjb3JyZXNwb25kaW5nIGdyYXBoXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9IGlmIG5vZGVzIHBhcmFtIGlzIGRlZmluZWQsIHtMYXlvdXQuX25vZGVzfSBvdGhlcndpc2Vcblx0ICovXG5cdG5vZGVzIDogZnVuY3Rpb24obm9kZXMpIHtcblx0XHRpZiAobm9kZXMpIHtcblx0XHRcdHRoaXMuX2lzVXBkYXRlID0gbm9kZXMgPyB0cnVlIDogZmFsc2U7XG5cdFx0XHR0aGlzLl9ub2RlcyA9IG5vZGVzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbm9kZXM7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGxpbmsgbWFwIG9mIHRoZSBsYXlvdXQuICAgU2V0IGZyb20gdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSBsaW5rTWFwIC0gYSBtYXAgZnJvbSBub2RlIGluZGV4IHRvIGEgc2V0IG9mIGxpbmVzIChwYXRoIG9iamVjdHMpIHRoYXQgY29udGFpbiB0aGF0IG5vZGVcblx0ICogQHJldHVybnMge0xheW91dH0gaWYgbGlua01hcCBwYXJhbSBpcyBkZWZpbmVkLCB7TGF5b3V0Ll9saW5rTWFwfSBvdGhlcndpc2Vcblx0ICovXG5cdGxpbmtNYXAgOiBmdW5jdGlvbihsaW5rTWFwKSB7XG5cdFx0aWYgKGxpbmtNYXApIHtcblx0XHRcdHRoaXMuX2xpbmtNYXAgPSBsaW5rTWFwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGlua01hcDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbm9kZSBtYXAgb2YgdGhlIGxheW91dC4gICBTZXQgZnJvbSB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIG5vZGVNYXAgLSBhIG1hcCBmcm9tIG5vZGUgaW5kZXggdG8gYSBjaXJjbGUgKHBhdGggb2JqZWN0KVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fSBpZiBub2RlTWFwIHBhcmFtIGlzIGRlZmluZWQsIHtMYXlvdXQuX25vZGVNYXB9IG90aGVyd2lzZVxuXHQgKi9cblx0bm9kZU1hcCA6IGZ1bmN0aW9uKG5vZGVNYXApIHtcblx0XHRpZiAobm9kZU1hcCkge1xuXHRcdFx0dGhpcy5fbm9kZU1hcCA9IG5vZGVNYXA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9ub2RlTWFwO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBsYWJlbCBvZiB0aGUgbGF5b3V0LiAgIFNldCBmcm9tIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbGFiZWxNYXAgLSBhIG1hcCBmcm9tIG5vZGUgaW5kZXggdG8gYSB0ZXh0IG9iamVjdCAocGF0aCBvYmplY3QpXG5cdCAqIEByZXR1cm5zIHtMYXlvdXR9IGlmIGxhYmVsTWFwIHBhcmFtIGlzIGRlZmluZWQsIHtMYXlvdXQuX2xhYmVsTWFwfSBvdGhlcndpc2Vcblx0ICovXG5cdGxhYmVsTWFwIDogZnVuY3Rpb24obGFiZWxNYXApIHtcblx0XHRpZiAobGFiZWxNYXApIHtcblx0XHRcdHRoaXMuX2xhYmVsTWFwID0gbGFiZWxNYXA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9sYWJlbE1hcDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBib3VuZGluZyBib3ggZm9yIGFuIGFycmF5IG9mIG5vZGUgaW5kaWNlc1xuXHQgKiBAcGFyYW0gbm9kZU9ySW5kZXhBcnJheSAtIGFycmF5IG9mIG5vZGUgaW5kaWNpZXMgb3Igbm9kZSBhcnJheSBpdHNlbGZcblx0ICogQHBhcmFtIHBhZGRpbmcgLSBwYWRkaW5nIGluIHBpeGVscyBhcHBsaWVkIHRvIGJvdW5kaW5nIGJveFxuXHQgKiBAcmV0dXJucyB7e21pbjoge3g6IE51bWJlciwgeTogTnVtYmVyfSwgbWF4OiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9fX1cblx0ICovXG5cdGdldEJvdW5kaW5nQm94IDogZnVuY3Rpb24obm9kZU9ySW5kZXhBcnJheSxwYWRkaW5nKSB7XG5cdFx0aWYgKCFub2RlT3JJbmRleEFycmF5IHx8ICFub2RlT3JJbmRleEFycmF5Lmxlbmd0aCB8fCBub2RlT3JJbmRleEFycmF5Lmxlbmd0aCA9PT0gMCB8fCBPYmplY3Qua2V5cyh0aGlzLl9ub2RlTWFwKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHggOiAwLFxuXHRcdFx0XHR5IDogMCxcblx0XHRcdFx0d2lkdGggOiAxLFxuXHRcdFx0XHRoZWlnaHQgOiAxXG5cdFx0XHR9O1xuXHRcdH1cblxuXG5cdFx0dmFyIG1pbiA9IHtcblx0XHRcdHggOiBOdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0eSA6IE51bWJlci5NQVhfVkFMVUVcblx0XHR9O1xuXHRcdHZhciBtYXggPSB7XG5cdFx0XHR4IDogLU51bWJlci5NQVhfVkFMVUUsXG5cdFx0XHR5IDogLU51bWJlci5NQVhfVkFMVUVcblx0XHR9O1xuXG5cdFx0dmFyIGJiUGFkZGluZyA9IHBhZGRpbmcgfHwgMDtcblxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRub2RlT3JJbmRleEFycmF5LmZvckVhY2goZnVuY3Rpb24obm9kZU9ySW5kZXgpIHtcblx0XHRcdHZhciBpZHggPSBub2RlT3JJbmRleCBpbnN0YW5jZW9mIE9iamVjdCA/IG5vZGVPckluZGV4LmluZGV4IDogbm9kZU9ySW5kZXg7XG5cdFx0XHR2YXIgY2lyY2xlID0gdGhhdC5fbm9kZU1hcFtpZHhdO1xuXHRcdFx0bWluLnggPSBNYXRoLm1pbihtaW4ueCwgKGNpcmNsZS5maW5hbFggfHwgY2lyY2xlLngpIC0gKGNpcmNsZS5yYWRpdXMgKyBiYlBhZGRpbmcpKTtcblx0XHRcdG1pbi55ID0gTWF0aC5taW4obWluLnksIChjaXJjbGUuZmluYWxZIHx8IGNpcmNsZS55KSAtIChjaXJjbGUucmFkaXVzICsgYmJQYWRkaW5nKSk7XG5cdFx0XHRtYXgueCA9IE1hdGgubWF4KG1heC54LCAoY2lyY2xlLmZpbmFsWCB8fCBjaXJjbGUueCkgKyAoY2lyY2xlLnJhZGl1cyArIGJiUGFkZGluZykpO1xuXHRcdFx0bWF4LnkgPSBNYXRoLm1heChtYXgueSwgKGNpcmNsZS5maW5hbFkgfHwgY2lyY2xlLnkpICsgKGNpcmNsZS5yYWRpdXMgKyBiYlBhZGRpbmcpKTtcblx0XHR9KTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0eCA6IG1pbi54LFxuXHRcdFx0eSA6IG1pbi55LFxuXHRcdFx0d2lkdGggOiAobWF4LnggLSBtaW4ueCksXG5cdFx0XHRoZWlnaHQgOiAobWF4LnkgLSBtaW4ueSlcblx0XHR9O1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHdoZXRoZXJlIHdlIHNob3VsZCBhcHBseSB6b29tIHdoZW4gcGVyZm9ybWluZyBhIGxheW91dC4gICBTaG91bGQgbmV2ZXIgYmVcblx0ICogY2FsbGVkIGJ5IHVzZXJcblx0ICogQHBhcmFtIGJBcHBseVxuXHQgKiBAcmV0dXJucyB7TGF5b3V0fVxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2FwcGx5Wm9vbVNjYWxlIDogZnVuY3Rpb24oYkFwcGx5KSB7XG5cdFx0dGhpcy5fYXBwbHlab29tID0gYkFwcGx5O1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBwb3NpdGlvbiBvZiBhIG5vZGUgYW5kIGFsbCBhdHRhY2hlZCBsaW5rcyBhbmQgbGFiZWxzIHdpdGhvdXQgYW5pbWF0aW9uXG5cdCAqIEBwYXJhbSBub2RlIC0gdGhlIG5vZGUgb2JqZWN0IGJlaW5nIHBvc2l0aW9uZWRcblx0ICogQHBhcmFtIHggLSB0aGUgbmV3IHggcG9zaXRpb24gZm9yIHRoZSBub2RlXG5cdCAqIEBwYXJhbSB5IC0gdGhlIG5ldyB5IHBvc2l0aW9uIGZvciB0aGUgbm9kZVxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3NldE5vZGVQb3NpdGlvbkltbWVkaWF0ZSA6IGZ1bmN0aW9uKG5vZGUseCx5LGNhbGxiYWNrKSB7XG5cdFx0dGhpcy5fc2V0Tm9kZVBvc2l0aW9uKG5vZGUseCx5LHRydWUpO1xuXHRcdGlmIChjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHBvc2l0aW9uIG9mIGEgbm9kZSBieSBhbmltYXRpbmcgZnJvbSBpdCdzIG9sZCBwb3NpdGlvbiB0byBpdCdzIG5ldyBvbmVcblx0ICogQHBhcmFtIG5vZGUgLSB0aGUgbm9kZSBiZWluZyByZXBvc2l0aW9uZWRcblx0ICogQHBhcmFtIHggLSB0aGUgbmV3IHggcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIHkgLSB0aGUgbmV3IHkgcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIGJJbW1lZGlhdGUgLSBpZiB0cnVlLCBzZXRzIHdpdGhvdXQgYW5pbWF0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3NldE5vZGVQb3NpdGlvbiA6IGZ1bmN0aW9uKG5vZGUsbmV3WCxuZXdZLGJJbW1lZGlhdGUsY2FsbGJhY2spIHtcblx0XHR2YXIgeCA9IG5ld1ggKiAodGhpcy5fYXBwbHlab29tID8gdGhpcy5fem9vbVNjYWxlIDogMSk7XG5cdFx0dmFyIHkgPSBuZXdZICogKHRoaXMuX2FwcGx5Wm9vbSA/IHRoaXMuX3pvb21TY2FsZSA6IDEpO1xuXG5cblx0XHQvLyBVcGRhdGUgdGhlIG5vZGUgcmVuZGVyIG9iamVjdFxuXHRcdHZhciBjaXJjbGUgPSB0aGlzLl9ub2RlTWFwW25vZGUuaW5kZXhdO1xuXHRcdGlmIChiSW1tZWRpYXRlIT09dHJ1ZSkge1xuXHRcdFx0Y2lyY2xlLnR3ZWVuQXR0cih7XG5cdFx0XHRcdHg6IHgsXG5cdFx0XHRcdHk6IHlcblx0XHRcdH0sIHtcblx0XHRcdFx0ZHVyYXRpb246IHRoaXMuX2R1cmF0aW9uLFxuXHRcdFx0XHRlYXNpbmc6IHRoaXMuX2Vhc2luZyxcblx0XHRcdFx0Y2FsbGJhY2sgOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRkZWxldGUgY2lyY2xlLmZpbmFsWDtcblx0XHRcdFx0XHRkZWxldGUgY2lyY2xlLmZpbmFsWTtcblx0XHRcdFx0XHRub2RlLnggPSB4O1xuXHRcdFx0XHRcdG5vZGUueSA9IHk7XG5cdFx0XHRcdFx0aWYgKGNhbGxiYWNrKSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjaXJjbGUuZmluYWxYID0geDtcblx0XHRcdGNpcmNsZS5maW5hbFkgPSB5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjaXJjbGUueCA9IHg7XG5cdFx0XHRjaXJjbGUueSA9IHk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9saW5rTWFwW25vZGUuaW5kZXhdLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bm9kZS54ID0geDtcblx0XHRcdG5vZGUueSA9IHk7XG5cdFx0XHRjaXJjbGUueCA9IHg7XG5cdFx0XHRjaXJjbGUueSA9IHk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRoZSBsYWJlbCByZW5kZXIgb2JqZWN0XG5cdFx0dmFyIGxhYmVsID0gdGhpcy5fbGFiZWxNYXBbbm9kZS5pbmRleF07XG5cdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHR2YXIgbGFiZWxQb3MgPSB0aGlzLmxheW91dExhYmVsKGNpcmNsZSk7XG5cdFx0XHRpZiAoYkltbWVkaWF0ZSE9PXRydWUpIHtcblx0XHRcdFx0bGFiZWwudHdlZW5BdHRyKGxhYmVsUG9zLCB7XG5cdFx0XHRcdFx0ZHVyYXRpb246IHRoaXMuX2R1cmF0aW9uLFxuXHRcdFx0XHRcdGVhc2luZzogdGhpcy5fZWFzaW5nXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yICh2YXIgcHJvcCBpbiBsYWJlbFBvcykge1xuXHRcdFx0XHRcdGlmIChsYWJlbFBvcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuXHRcdFx0XHRcdFx0bGFiZWxbcHJvcF0gPSBsYWJlbFBvc1twcm9wXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdC8vIFVwZGF0ZSB0aGUgbGluayByZW5kZXIgb2JqZWN0XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX2xpbmtNYXBbbm9kZS5pbmRleF0uZm9yRWFjaChmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHR2YXIgbGlua09iaktleSA9IG51bGw7XG5cdFx0XHRpZiAobGluay5zb3VyY2UuaW5kZXggPT09IG5vZGUuaW5kZXgpIHtcblx0XHRcdFx0bGlua09iaktleSA9ICdzb3VyY2UnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGlua09iaktleSA9ICd0YXJnZXQnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGJJbW1lZGlhdGUhPT10cnVlKSB7XG5cdFx0XHRcdGxpbmsudHdlZW5PYmoobGlua09iaktleSwge1xuXHRcdFx0XHRcdHg6IHgsXG5cdFx0XHRcdFx0eTogeVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0ZHVyYXRpb246IHRoYXQuX2R1cmF0aW9uLFxuXHRcdFx0XHRcdGVhc2luZzogdGhhdC5fZWFzaW5nXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGlua1tsaW5rT2JqS2V5XS54ID0geDtcblx0XHRcdFx0bGlua1tsaW5rT2JqS2V5XS55ID0geTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSxcblxuXHQvKipcblx0ICogTGF5b3V0IGhhbmRsZXIuICAgQ2FsbHMgaW1wbGVtZW50aW5nIGxheW91dCByb3V0aW5lIGFuZCBwcm92aWRlcyBhIGNhbGxiYWNrIGlmIGl0J3MgYXN5bmNcblx0ICogQHBhcmFtIHcgLSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhcyBiZWluZyByZW5kZXJlZCB0b1xuXHQgKiBAcGFyYW0gaCAtIHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyBiZWluZyByZW5kZXJlZCB0b1xuXHQgKiBAcmV0dXJucyB7TGF5b3V0fVxuXHQgKi9cblx0bGF5b3V0IDogZnVuY3Rpb24odyxoLGNhbGxiYWNrKSB7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGZ1bmN0aW9uIG9uQ29tcGxldGUoKSB7XG5cdFx0XHR0aGF0Ll9ldmVudHNTdXNwZW5kZWQgPSBmYWxzZTtcblx0XHRcdGlmIChjYWxsYmFjaykge1xuXHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2V2ZW50c1N1c3BlbmRlZCA9IHRydWU7XG5cdFx0dmFyIGlzQXN5bmMgPSAhdGhpcy5fcGVyZm9ybUxheW91dCh3LGgpO1xuXHRcdGlmIChpc0FzeW5jKSB7XG5cdFx0XHRzZXRUaW1lb3V0KG9uQ29tcGxldGUsdGhpcy5kdXJhdGlvbigpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b25Db21wbGV0ZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogRGVmYXVsdCBsYXlvdXQgdGhhdCBkb2VzIG5vdGhpbmcuICAgU2hvdWxkIGJlIG92ZXJyaWRlblxuXHQgKiBAcGFyYW0gd1xuXHQgKiBAcGFyYW0gaFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3BlcmZvcm1MYXlvdXQgOiBmdW5jdGlvbih3LGgpIHtcblxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFx0LyoqXG5cdCAqIEhvb2sgZm9yIGRvaW5nIGFueSBkcmF3aW5nIGJlZm9yZSByZW5kZXJpbmcgb2YgdGhlIGdyYXBoIHRoYXQgaXMgbGF5b3V0IHNwZWNpZmljXG5cdCAqIGllLyBCYWNrZ3JvdW5kcywgZXRjXG5cdCAqIEBwYXJhbSB3IC0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXNcblx0ICogQHBhcmFtIGggLSB0aGUgaGVpZ2h0IG9mIHRoZSBjYW52YXNcblx0ICogQHJldHVybnMge0FycmF5fSAtIGEgbGlzdCBvZiBwYXRoLmpzIHJlbmRlciBvYmplY3RzIHRvIGJlIGFkZGVkIHRvIHRoZSBzY2VuZVxuXHQgKi9cblx0cHJlcmVuZGVyIDogZnVuY3Rpb24odyxoKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBIb29rIGZvciBkb2luZyBhbnkgZHJhd2luZyBhZnRlciByZW5kZXJpbmcgb2YgdGhlIGdyYXBoIHRoYXQgaXMgbGF5b3V0IHNwZWNpZmljXG5cdCAqIGllLyBPdmVybGF5cywgZXRjXG5cdCAqIEBwYXJhbSB3IC0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXNcblx0ICogQHBhcmFtIGggLSB0aGUgaGVpZ2h0IG9mIHRoZSBjYW52YXNcblx0ICogQHJldHVybnMge0FycmF5fSAtIGEgbGlzdCBvZiBwYXRoLmpzIHJlbmRlciBvYmplY3RzIHRvIGJlIGFkZGVkIHRvIHRoZSBzY2VuZVxuXHQgKi9cblx0cG9zdHJlbmRlciA6IGZ1bmN0aW9uKHcsaCkge1xuXHRcdHJldHVybiBbXTtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGJhY2sgZm9yIHVwZGF0aW5nIHBvc3QgcmVuZGVyIG9iamVjdHMuICAgVXN1YWxseSByZW5kZXJlZCBpbiBzY3JlZW5zcGFjZVxuXHQgKiBAcGFyYW0gbWlueCAtIG1pbiB4IGNvb3JkaW5hdGUgb2Ygc2NyZWVuXG5cdCAqIEBwYXJhbSBtaW55IC0gbWluIHkgY29vcmRpbmF0ZSBvZiBzY3JlZW5cblx0ICogQHBhcmFtIG1heHggLSBtYXggeCBjb29yZGluYXRlIG9mIHNjcmVlblxuXHQgKiBAcGFyYW0gbWF4eSAtIG1heCB5IGNvb3JkaW5hdGUgb2Ygc2NyZWVuXG5cdCAqL1xuXHRwb3N0cmVuZGVyVXBkYXRlIDogZnVuY3Rpb24obWlueCxtaW55LG1heHgsbWF4eSkge1xuXG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGxhYmVsIHBvc2l0aW9uIGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVYIC0gdGhlIHggcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIG5vZGVZIC0gdGhlIHkgcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIHJhZGl1cyAtIHRoZSByYWRpdXMgb2YgdGhlIG5vZGVcblx0ICogQHJldHVybnMge3t4OiB4IHBvc2l0aW9uIG9mIHRoZSBsYWJlbCwgeTogeSBwb3NpdGlvbiBvZiB0aGUgbGFiZWx9fVxuXHQgKi9cblx0bGF5b3V0TGFiZWwgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHg6IG5vZGUueCArIG5vZGUucmFkaXVzICsgNSxcblx0XHRcdHk6IG5vZGUueSArIG5vZGUucmFkaXVzICsgNVxuXHRcdH07XG5cdH1cbn0pO1xuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBMYXlvdXQ7XG4iLCJ2YXIgTElOS19UWVBFID0ge1xuXHRERUZBVUxUIDogJ2xpbmUnLFxuXHRMSU5FIDogJ2xpbmUnLFxuXHRBUlJPVyA6ICdhcnJvdycsXG5cdEFSQyA6ICdhcmMnXG59O1xubW9kdWxlLmV4cG9ydHMgPSBMSU5LX1RZUEU7IiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBMSU5LX1RZUEUgPSByZXF1aXJlKCcuL2xpbmtUeXBlJyk7XG52YXIgTGF5b3V0ID0gcmVxdWlyZSgnLi9sYXlvdXQnKTtcblxudmFyIFJFR1JPVU5EX0JCX1BBRERJTkcgPSAwO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBHcmFwaCByZW5kZXIgb2JqZWN0XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIEdyYXBoID0gZnVuY3Rpb24oYXR0cmlidXRlcykge1xuXHR0aGlzLl9ub2RlcyA9IFtdO1xuXHR0aGlzLl9saW5rcyA9IFtdO1xuXHR0aGlzLl9jYW52YXMgPSBudWxsO1xuXHR0aGlzLl9sYXlvdXRlciA9IG51bGw7XG5cdHRoaXMuX2dyb3VwaW5nTWFuYWdlciA9IG51bGw7XG5cdHRoaXMuX3dpZHRoID0gMDtcblx0dGhpcy5faGVpZ2h0ID0gMDtcblx0dGhpcy5fem9vbVNjYWxlID0gMS4wO1xuXHR0aGlzLl96b29tTGV2ZWwgPSAwO1xuXHR0aGlzLl9zY2VuZSA9IG51bGw7XG5cdHRoaXMuX3Nob3dBbGxMYWJlbHMgPSBmYWxzZTtcblx0dGhpcy5fcHJlcmVuZGVyR3JvdXAgPSBudWxsO1xuXHR0aGlzLl9wb3N0cmVuZGVyR3JvdXAgPSBudWxsO1xuXHR0aGlzLl9wYW5uYWJsZSA9IG51bGw7XG5cdHRoaXMuX3pvb21hYmxlID0gbnVsbDtcblx0dGhpcy5fZHJhZ2dhYmxlID0gbnVsbDtcblx0dGhpcy5fY3VycmVudE92ZXJOb2RlID0gbnVsbDtcblx0dGhpcy5fY3VycmVudE1vdmVTdGF0ZSA9IG51bGw7XG5cdHRoaXMuX2ludmVydGVkUGFuID0gMTtcblxuXHR0aGlzLl9mb250U2l6ZSA9IG51bGw7XG5cdHRoaXMuX2ZvbnRGYW1pbHkgPSBudWxsO1xuXHR0aGlzLl9mb250Q29sb3IgPSBudWxsO1xuXHR0aGlzLl9mb250U3Ryb2tlID0gbnVsbDtcblx0dGhpcy5fZm9udFN0cm9rZVdpZHRoID0gbnVsbDtcblx0dGhpcy5fc2hhZG93Q29sb3IgPSBudWxsO1xuXHR0aGlzLl9zaGFkb3dPZmZzZXRYID0gbnVsbDtcblx0dGhpcy5fc2hhZG93T2Zmc2V0WSA9IG51bGw7XG5cdHRoaXMuX3NoYWRvd0JsdXIgPSBudWxsO1xuXG5cdC8vIERhdGEgdG8gcmVuZGVyIG9iamVjdCBtYXBzXG5cdHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmUgPSB7fTtcblx0dGhpcy5fbm9kZUluZGV4VG9DaXJjbGUgPSB7fTtcblx0dGhpcy5fbm9kZUluZGV4VG9MYWJlbCA9IHt9O1xuXG5cdF8uZXh0ZW5kKHRoaXMsYXR0cmlidXRlcyk7XG59O1xuXG5HcmFwaC5wcm90b3R5cGUgPSBfLmV4dGVuZChHcmFwaC5wcm90b3R5cGUsIHtcblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbm9kZXMgZm9yIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbm9kZXMgLSBhbiBhcnJheSBvZiBub2Rlc1xuXHQgKiB7XG5cdCAqIFx0XHR4IDogdGhlIHggY29vcmRpbmF0ZSBvZiB0aGUgbm9kZVx0KHJlcXVpcmVkKVxuXHQgKiBcdFx0eSA6IHRoZSB5IGNvb3JkaW5hdGUgb2YgdGhlIG5vZGVcdChyZXF1aXJlZClcblx0ICpcdFx0aW5kZXggOiAgYSB1bmlxdWUgaW5kZXhcdFx0XHRcdChyZXF1aXJlZClcblx0ICpcdFx0bGFiZWwgOiBhIGxhYmVsIGZvciB0aGUgbm9kZVx0XHQob3B0aW9uYWwpXG5cdCAqXHRcdGZpbGxTdHlsZSA6IGEgY2FudmFzIGZpbGwgICBcdFx0KG9wdGlvbmFsLCBkZWZhdWx0ICMwMDAwMDApXG5cdCAqXHRcdHN0cm9rZVN0eWxlIDogYSBjYW52YXMgc3Ryb2tlXHRcdChvcHRpb25hbCwgZGVmYXVsdCB1bmRlZmluZWQpXG5cdCAqXHRcdGxpbmVXaWR0aCA6IHdpZHRoIG9mIHRoZSBzdHJva2VcdFx0KG9wdGlvbmFsLCBkZWZhdWx0IDEpXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgbm9kZXMgcGFyYW1ldGVyIGlzIGRlZmluZWQsIHtHcmFwaC5fbm9kZXN9IG90aGVyd2lzZVxuXHQgKi9cblx0bm9kZXMgOiBmdW5jdGlvbihub2Rlcykge1xuXHRcdGlmIChub2Rlcykge1xuXHRcdFx0dGhpcy5fbm9kZXMgPSBub2RlcztcblxuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSA9IHt9O1xuXHRcdFx0dGhpcy5fbm9kZUluZGV4VG9DaXJjbGUgPSB7fTtcblx0XHRcdHRoaXMuX25vZGVJbmRleFRvTGFiZWwgPSB7fTtcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdG5vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0XHR0aGF0Ll9ub2RlSW5kZXhUb0xpbmtMaW5lW25vZGUuaW5kZXhdID0gW107fSk7XG5cdFx0XHRpZiAodGhpcy5fbGF5b3V0ZXIpIHtcblx0XHRcdFx0dGhpcy5fbGF5b3V0ZXIubm9kZXMobm9kZXMpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9ub2Rlcztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCBub2RlIHJlbmRlciBvYmplY3Rcblx0ICogQHBhcmFtIG5vZGVJbmRleCAtIGluZGV4IG9mIHRoZSBub2RlXG5cdCAqIEByZXR1cm5zIHBhdGhqcyBjaXJjbGUgb2JqZWN0XG5cdCAqL1xuXHRub2RlV2l0aEluZGV4IDogZnVuY3Rpb24obm9kZUluZGV4KSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlW25vZGVJbmRleF07XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCBsYWJlbCByZW5kZXIgb2JqZWN0IGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVJbmRleCAtIGluZGV4IG9mIHRoZSBub2RlXG5cdCAqIEByZXR1cm5zIHBhdGhqcyByZW5kZXIgb2JqZWN0XG5cdCAqL1xuXHRsYWJlbFdpdGhJbmRleCA6IGZ1bmN0aW9uKG5vZGVJbmRleCkge1xuXHRcdHJldHVybiB0aGlzLl9ub2RlSW5kZXhUb0xhYmVsW25vZGVJbmRleF07XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwZGF0ZSB0aGUgcmVuZGVyIHByb3BlcnRpZXMgb2YgYSBub2RlXG5cdCAqIEBwYXJhbSBub2RlSW5kZXggLSBpbmRleCBvZiB0aGUgbm9kZVxuXHQgKiBAcGFyYW0gcHJvcHMgLSBhbnkgcGF0aGpzIHByb3BlcnRpZXMgd2Ugd2lzaCB0byB1cGRhdGVcblx0ICovXG5cdHVwZGF0ZU5vZGUgOiBmdW5jdGlvbihub2RlSW5kZXgscHJvcHMpIHtcblx0XHQvLyBUT0RPOiAgcmVtb3ZlIG11Y2tpbmcgd2l0aCBwb3NpdGlvbiBzZXR0aW5ncyBmcm9tIHByb3BzP1xuXHRcdGlmIChub2RlSW5kZXgpIHtcblx0XHRcdHZhciBjaXJjbGUgPSB0aGlzLl9ub2RlSW5kZXhUb0NpcmNsZVtub2RlSW5kZXhdO1xuXHRcdFx0Y2lyY2xlID0gXy5leHRlbmQoY2lyY2xlLHByb3BzKTtcblx0XHRcdHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlW25vZGVJbmRleF0gPSBjaXJjbGU7XG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSByZW5kZXIgcHJvcGVydGllcyBvZiBhIGxhYmVsXG5cdCAqIEBwYXJhbSBub2RlSW5kZXggLSBpbmRleCBvZiB0aGUgbm9kZSB0aGlzIGxhYmVsIGlzIGF0dGFjaGVkIHRvXG5cdCAqIEBwYXJhbSBwcm9wcyAtIGFueSBwYXRoanMgcHJvcGVydGllcnMgd2Ugd2l0aCB0byB1cGRhdGVcblx0ICovXG5cdHVwZGF0ZUxhYmVsIDogZnVuY3Rpb24obm9kZUluZGV4LHByb3BzKSB7XG5cdFx0Ly8gVE9ETzogIHJlbW92ZSBtdWNraW5nIHdpdGggcG9zaXRpb24gc2V0dGluZ3MgZnJvbSBwcm9wcz9cblx0XHRpZiAobm9kZUluZGV4KSB7XG5cdFx0XHR2YXIgdGV4dCA9IHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZUluZGV4XTtcblx0XHRcdHRleHQgPSBfLmV4dGVuZCh0ZXh0LHByb3BzKTtcblx0XHRcdHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZUluZGV4XSA9IHRleHQ7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgbm9kZXMgZm9yIHRoZSBncmFwaFxuXHQgKiBAcGFyYW0gbGlua3MgLSBhbiBhcnJheSBvZiBsaW5rc1xuXHQgKiB7XG5cdCAqIFx0XHRzb3VyY2UgOiBhIG5vZGUgb2JqZWN0IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNvdXJjZSBcdChyZXF1aXJlZClcblx0ICogXHRcdHRhcmdldCA6IGEgbm9kZSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGUgdGFyZ2V0XHQocmVxdWlyZWQpXG5cdCAqXHRcdHN0cm9rZVN0eWxlIDogYSBjYW52YXMgc3Ryb2tlXHRcdFx0XHRcdFx0KG9wdGlvbmFsLCBkZWZhdWx0ICMwMDAwMDApXG5cdCAqXHRcdGxpbmVXaWR0aCA6IHRoZSB3aWR0aCBvZiB0aGUgc3Ryb2tlXHRcdFx0XHRcdChvcHRpbmFsLCBkZWZhdWx0IDEpXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgbGlua3MgcGFyYW1ldGVyIGlzIGRlZmluZWQsIHtHcmFwaC5fbGlua3N9IG90aGVyd2lzZVxuXHQgKi9cblx0bGlua3MgOiBmdW5jdGlvbihsaW5rcykge1xuXHRcdGlmIChsaW5rcykge1xuXHRcdFx0dGhpcy5fbGlua3MgPSBsaW5rcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xpbmtzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cyB0aGUgbGlua3MgYmV0d2VlbiB0d28gbm9kZXNcblx0ICogQHBhcmFtIHNvdXJjZU5vZGVJbmRleCAtIEluZGV4IG9mIHNvdXJjZSBub2RlLCBpZiBudWxsLCByZXR1cm4gYWxsIGxpbmtzIGdvaW5nIHRvIHRhcmdldFxuXHQgKiBAcGFyYW0gdGFyZ2V0Tm9kZUluZGV4IC0gSW5kZXggb2YgdGFyZ2V0IG5vZGUsIGlmIG51bGwsIHJldHVybiBhbGwgbGlua3Mgc3RhcnRpbmcgZnJvbSBzb3VyY2Vcblx0ICovXG5cdGxpbmtPYmplY3RzQmV0d2VlbiA6IGZ1bmN0aW9uKHNvdXJjZU5vZGVJbmRleCx0YXJnZXROb2RlSW5kZXgpIHtcblx0XHRmdW5jdGlvbiBpc1Byb3ZpZGVkKHBhcmFtKSB7XG5cdFx0XHRpZiAocGFyYW0gPT09IHVuZGVmaW5lZCB8fCBwYXJhbSA9PT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXNQcm92aWRlZChzb3VyY2VOb2RlSW5kZXgpICYmICFpc1Byb3ZpZGVkKHRhcmdldE5vZGVJbmRleCkpIHtcblx0XHRcdHZhciBhbGxTb3VyY2UgPSB0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lW3NvdXJjZU5vZGVJbmRleF07XG5cdFx0XHR2YXIganVzdFNvdXJjZSA9IGFsbFNvdXJjZS5maWx0ZXIoZnVuY3Rpb24obGluaykge1xuXHRcdFx0XHRyZXR1cm4gbGluay5zb3VyY2UuaW5kZXggPT09IHNvdXJjZU5vZGVJbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGp1c3RTb3VyY2U7XG5cdFx0fSBlbHNlIGlmICghaXNQcm92aWRlZChzb3VyY2VOb2RlSW5kZXgpICYmIGlzUHJvdmlkZWQodGFyZ2V0Tm9kZUluZGV4KSkge1xuXHRcdFx0dmFyIGFsbFRhcmdldCA9IHRoaXMuX25vZGVJbmRleFRvTGlua0xpbmVbdGFyZ2V0Tm9kZUluZGV4XTtcblx0XHRcdHZhciBqdXN0VGFyZ2V0ID0gYWxsVGFyZ2V0LmZpbHRlcihmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHRcdHJldHVybiBsaW5rLnRhcmdldC5pbmRleCA9PT0gdGFyZ2V0Tm9kZUluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4ganVzdFRhcmdldDtcblx0XHR9IGVsc2UgaWYgKGlzUHJvdmlkZWQoc291cmNlTm9kZUluZGV4KSAmJiBpc1Byb3ZpZGVkKHRhcmdldE5vZGVJbmRleCkpIHtcblx0XHRcdHZhciBzb3VyY2VMaW5rcyA9IHRoaXMubGlua09iamVjdHNCZXR3ZWVuKHNvdXJjZU5vZGVJbmRleCxudWxsKTtcblx0XHRcdHZhciB0b1RhcmdldCA9IHNvdXJjZUxpbmtzLmZpbHRlcihmdW5jdGlvbihsaW5rKSB7XG5cdFx0XHRcdHJldHVybiBsaW5rLnRhcmdldC5pbmRleCA9PT0gdGFyZ2V0Tm9kZUluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdG9UYXJnZXQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgY2FudmFzIGZvciB0aGUgZ3JhcGhcblx0ICogQHBhcmFtIGNhbnZhcyAtIGFuIEhUTUwgY2FudmFzIG9iamVjdFxuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGNhbnZhcyBwYXJhbWV0ZXIgaXMgZGVmaW5lZCwgdGhlIGNhbnZhcyBvdGhlcndpc2Vcblx0ICovXG5cdGNhbnZhcyA6IGZ1bmN0aW9uKGNhbnZhcykge1xuXHRcdGlmIChjYW52YXMpIHtcblx0XHRcdHRoaXMuX2NhbnZhcyA9IGNhbnZhcztcblxuXHRcdFx0dmFyIHgseTtcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdCQodGhpcy5fY2FudmFzKS5vbignbW91c2Vkb3duJyxmdW5jdGlvbihlKSB7XG5cdFx0XHRcdHggPSBlLmNsaWVudFg7XG5cdFx0XHRcdHkgPSBlLmNsaWVudFk7XG5cdFx0XHRcdCQodGhhdC5fY2FudmFzKS5vbignbW91c2Vtb3ZlJyxmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0dmFyIGR4ID0geCAtIGUuY2xpZW50WDtcblx0XHRcdFx0XHR2YXIgZHkgPSB5IC0gZS5jbGllbnRZO1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9kcmFnZ2FibGUgJiYgdGhhdC5fY3VycmVudE92ZXJOb2RlICYmICh0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID09PSBudWxsIHx8IHRoYXQuX2N1cnJlbnRNb3ZlU3RhdGUgPT09ICdkcmFnZ2luZycpKSAge1xuXHRcdFx0XHRcdFx0dGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9ICdkcmFnZ2luZyc7XG5cblx0XHRcdFx0XHRcdC8vIE1vdmUgdGhlIG5vZGVcblx0XHRcdFx0XHRcdHRoYXQuX2xheW91dGVyLl9zZXROb2RlUG9zaXRpb25JbW1lZGlhdGUodGhhdC5fY3VycmVudE92ZXJOb2RlLCB0aGF0Ll9jdXJyZW50T3Zlck5vZGUueCAtIGR4LCB0aGF0Ll9jdXJyZW50T3Zlck5vZGUueSAtIGR5KTtcblx0XHRcdFx0XHRcdHRoYXQudXBkYXRlKCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0aGF0Ll9wYW5uYWJsZSAmJiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9PT0gbnVsbCB8fCB0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID09PSAncGFubmluZycpKSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9wYW4oLWR4KnRoYXQuX2ludmVydGVkUGFuLC1keSp0aGF0Ll9pbnZlcnRlZFBhbik7XG5cdFx0XHRcdFx0XHR0aGF0Ll9jdXJyZW50TW92ZVN0YXRlID0gJ3Bhbm5pbmcnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR4ID0gZS5jbGllbnRYO1xuXHRcdFx0XHRcdHkgPSBlLmNsaWVudFk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdCQodGhpcy5fY2FudmFzKS5vbignbW91c2V1cCcsZnVuY3Rpb24oKSB7XG5cdFx0XHRcdCQodGhhdC5fY2FudmFzKS5vZmYoJ21vdXNlbW92ZScpO1xuXHRcdFx0XHRpZiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9PT0gJ2RyYWdnaW5nJykge1xuXHRcdFx0XHRcdHRoYXQuX2N1cnJlbnRPdmVyTm9kZSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhhdC5fY3VycmVudE1vdmVTdGF0ZSA9IG51bGw7XG5cdFx0XHR9KTtcblxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9jYW52YXM7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXQgd2lkdGhcblx0ICogQHJldHVybnMgV2lkdGggaW4gcGl4ZWxzIG9mIHRoZSBncmFwaFxuXHQgKi9cblx0d2lkdGggOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc2NlbmUud2lkdGg7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCBoZWlnaHRcblx0ICogQHJldHVybnMgSGVpZ2h0IGluIHBpeGVscyBvZiB0aGUgZ3JhcGhcblx0ICovXG5cdGhlaWdodCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9zY2VuZS5oZWlnaHQ7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRvZ2dsZXMgYm9vbGVhbiBmb3Igc2hvd2luZy9oaWRpbmcgYWxsIGxhYmVscyBpbiB0aGUgZ3JhcGggYnkgZGVmYXVsdFxuXHQgKiBAcGFyYW0gc2hvd0FsbExhYmVsc1xuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdHNob3dBbGxMYWJlbHMgOiBmdW5jdGlvbihzaG93QWxsTGFiZWxzKSB7XG5cdFx0aWYgKHNob3dBbGxMYWJlbHMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fc2hvd0FsbExhYmVscyA9IHNob3dBbGxMYWJlbHM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9zaG93QWxsTGFiZWxzO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZVxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdGlmIChzaG93QWxsTGFiZWxzKSB7XG5cdFx0XHRcdHRoYXQuYWRkTGFiZWwobm9kZSxub2RlLmxhYmVsVGV4dCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGF0LnJlbW92ZUxhYmVsKG5vZGUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBsYWJlbCBmb3IgYSBub2RlXG5cdCAqIEBwYXJhbSBub2RlXG5cdCAqIEBwYXJhbSB0ZXh0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGFkZExhYmVsIDogZnVuY3Rpb24obm9kZSx0ZXh0KSB7XG5cdFx0aWYgKHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZS5pbmRleF0pIHtcblx0XHRcdHRoaXMucmVtb3ZlTGFiZWwobm9kZSk7XG5cdFx0fVxuXHRcdHZhciBsYWJlbEF0dHJzID0gdGhpcy5fbGF5b3V0ZXIubGF5b3V0TGFiZWwobm9kZSk7XG5cblx0XHR2YXIgZm9udFNpemUgPSB0eXBlb2YodGhpcy5fZm9udFNpemUpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udFNpemUobm9kZSkgOiB0aGlzLl9mb250U2l6ZTtcblx0XHRpZiAoIWZvbnRTaXplKSB7XG5cdFx0XHRmb250U2l6ZSA9IDEwO1xuXHRcdH1cblxuXHRcdHZhciBmb250RmFtaWx5ID0gdHlwZW9mKHRoaXMuX2ZvbnRGYW1pbHkpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udEZhbWlseShub2RlKSA6IHRoaXMuX2ZvbnRGYW1pbHk7XG5cdFx0aWYgKCFmb250RmFtaWx5KSB7XG5cdFx0XHRmb250RmFtaWx5ID0gJ3NhbnMtc2VyaWYnO1xuXHRcdH1cblx0XHR2YXIgZm9udFN0ciA9IGZvbnRTaXplICsgJ3B4ICcgKyBmb250RmFtaWx5O1xuXG5cdFx0dmFyIGZvbnRGaWxsID0gdHlwZW9mKHRoaXMuX2ZvbnRDb2xvcikgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9mb250Q29sb3Iobm9kZSkgOiB0aGlzLl9mb250Q29sb3I7XG5cdFx0aWYgKCFmb250RmlsbCkge1xuXHRcdFx0Zm9udEZpbGwgPSAnIzAwMDAwMCc7XG5cdFx0fVxuXHRcdHZhciBmb250U3Ryb2tlID0gdHlwZW9mKHRoaXMuX2ZvbnRTdHJva2UpID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZm9udFN0cm9rZShub2RlKSA6IHRoaXMuX2ZvbnRTdHJva2U7XG5cdFx0dmFyIGZvbnRTdHJva2VXaWR0aCA9IHR5cGVvZih0aGlzLl9mb250U3Ryb2tlKSA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX2ZvbnRTdHJva2VXaWR0aCA6IHRoaXMuX2ZvbnRTdHJva2VXaWR0aDtcblxuXHRcdHZhciBsYWJlbFNwZWMgPSB7XG5cdFx0XHRmb250OiBmb250U3RyLFxuXHRcdFx0ZmlsbFN0eWxlOiBmb250RmlsbCxcblx0XHRcdHN0cm9rZVN0eWxlOiBmb250U3Ryb2tlLFxuXHRcdFx0bGluZVdpZHRoOiBmb250U3Ryb2tlV2lkdGgsXG5cdFx0XHR0ZXh0IDogdGV4dFxuXHRcdH07XG5cblx0XHR2YXIgYkFkZFNoYWRvdyA9IHRoaXMuX3NoYWRvd0JsdXIgfHwgdGhpcy5fc2hhZG93T2Zmc2V0WCB8fCB0aGlzLl9zaGFkb3dPZmZzZXRZIHx8IHRoaXMuX3NoYWRvd0NvbG9yO1xuXHRcdGlmIChiQWRkU2hhZG93KSB7XG5cdFx0XHRsYWJlbFNwZWNbJ3NoYWRvd0NvbG9yJ10gPSB0aGlzLl9zaGFkb3dDb2xvciB8fCAnIzAwMCc7XG5cdFx0XHRsYWJlbFNwZWNbJ3NoYWRvd09mZnNldFgnXSA9IHRoaXMuX3NoYWRvd09mZnNldFggfHwgMDtcblx0XHRcdGxhYmVsU3BlY1snc2hhZG93T2Zmc2V0WSddID0gdGhpcy5fc2hhZG93T2Zmc2V0WSB8fCAwO1xuXHRcdFx0bGFiZWxTcGVjWydzaGFkb3dCbHVyJ10gPSB0aGlzLl9zaGFkb3dCbHVyIHx8IE1hdGguZmxvb3IoZm9udFNpemUvMyk7XG5cdFx0fVxuXG5cdFx0Zm9yICh2YXIga2V5IGluIGxhYmVsQXR0cnMpIHtcblx0XHRcdGlmIChsYWJlbEF0dHJzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0bGFiZWxTcGVjW2tleV0gPSBsYWJlbEF0dHJzW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHZhciBsYWJlbCA9IHBhdGgudGV4dChsYWJlbFNwZWMpO1xuXHRcdHRoaXMuX25vZGVJbmRleFRvTGFiZWxbbm9kZS5pbmRleF0gPSBsYWJlbDtcblx0XHR0aGlzLl9zY2VuZS5hZGRDaGlsZChsYWJlbCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogUmVtb3ZlcyBhIGxhYmVsIGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0cmVtb3ZlTGFiZWwgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0dmFyIHRleHRPYmplY3QgPSB0aGlzLl9ub2RlSW5kZXhUb0xhYmVsW25vZGUuaW5kZXhdO1xuXHRcdGlmICh0ZXh0T2JqZWN0KSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0ZXh0T2JqZWN0KTtcblx0XHRcdGRlbGV0ZSB0aGlzLl9ub2RlSW5kZXhUb0xhYmVsW25vZGUuaW5kZXhdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogRXZlbnQgaGFuZGxlciBmb3IgbW91c2VvdmVyIG9mIGEgbm9kZVxuXHQgKiBAcGFyYW0gY2FsbGJhY2sobm9kZSlcblx0ICogQHBhcmFtIHNlbGYgLSB0aGUgb2JqZWN0IHRvIGJlIGJvdW5kIGFzICd0aGlzJyBpbiB0aGUgY2FsbGJhY2tcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bm9kZU92ZXIgOiBmdW5jdGlvbihjYWxsYmFjayxzZWxmKSB7XG5cdFx0aWYgKCFzZWxmKSB7XG5cdFx0XHRzZWxmID0gdGhpcztcblx0XHR9XG5cdFx0dGhpcy5fbm9kZU92ZXIgPSBjYWxsYmFjay5iaW5kKHNlbGYpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBFdmVudCBoYW5kbGVyIGZvciBtb3VzZW91dCBvZiBhIG5vZGVcblx0ICogQHBhcmFtIGNhbGxiYWNrKG5vZGUpXG5cdCAqIEBwYXJhbSBzZWxmIC0gdGhlIG9iamVjdCB0byBiZSBib3VuZCBhcyAndGhpcycgaW4gdGhlIGNhbGxiYWNrXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdG5vZGVPdXQgOiBmdW5jdGlvbihjYWxsYmFjayxzZWxmKSB7XG5cdFx0aWYgKCFzZWxmKSB7XG5cdFx0XHRzZWxmID0gdGhpcztcblx0XHR9XG5cdFx0dGhpcy5fbm9kZU91dCA9IGNhbGxiYWNrLmJpbmQoc2VsZik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENvbnZlbmllbmNlIGZ1bmN0aW9uIGZvciBzZXR0aW5nIG5vZGVPdmVyL25vZGVPdXQgaW4gYSBzaW5nbGUgY2FsbFxuXHQgKiBAcGFyYW0gb3ZlciAtIHRoZSBub2RlT3ZlciBldmVudCBoYW5kbGVyXG5cdCAqIEBwYXJhbSBvdXQgLSB0aGUgbm9kZU91dCBldmVudCBoYW5kbGVyXG5cdCAqIEBwYXJhbSBzZWxmIC0gdGhlIG9iamVjdCB0byBiZSBib3VuZCBhcyAndGhpcycgaW4gdGhlIGNhbGxiYWNrXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdG5vZGVIb3ZlciA6IGZ1bmN0aW9uKG92ZXIsb3V0LHNlbGYpIHtcblx0XHRpZiAoIXNlbGYpIHtcblx0XHRcdHNlbGYgPSB0aGlzO1xuXHRcdH1cblx0XHR0aGlzLm5vZGVPdmVyKG92ZXIsc2VsZik7XG5cdFx0dGhpcy5ub2RlT3V0KG91dCxzZWxmKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogRXZlbnQgaGFuZGxlciBmb3IgY2xpY2sgb2YgYSBub2RlXG5cdCAqIEBwYXJhbSBjYWxsYmFjayhub2RlKVxuXHQgKiBAcGFyYW0gc2VsZiAtIHRoZSBvYmplY3QgdG8gYmUgYm91bmQgYXMgJ3RoaXMnLiAgIERlZmF1bHRzIHRvIHRoZSBncmFwaCBvYmplY3Rcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0bm9kZUNsaWNrIDogZnVuY3Rpb24oY2FsbGJhY2ssc2VsZikge1xuXHRcdGlmICghc2VsZikge1xuXHRcdFx0c2VsZiA9IHRoaXM7XG5cdFx0fVxuXHRcdHRoaXMuX25vZGVDbGljayA9IGNhbGxiYWNrLmJpbmQoc2VsZik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFBhbiB7R3JhcGh9IGJ5IChkeCxkeSkuICAgQXV0b21hdGljYWxseSByZXJlbmRlciB0aGUgZ3JhcGguXG5cdCAqIEBwYXJhbSBkeCAtIEFtb3VudCBvZiBwYW4gaW4geCBkaXJlY3Rpb25cblx0ICogQHBhcmFtIGR5IC0gQW1vdW50IG9mIHBhbiBpbiB5IGRpcmVjdGlvblxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3BhbiA6IGZ1bmN0aW9uKGR4LGR5KSB7XG5cdFx0dGhpcy5fc2NlbmUueCArPSBkeDtcblx0XHR0aGlzLl9zY2VuZS55ICs9IGR5O1xuXHRcdHRoaXMuX3BhblggKz0gZHg7XG5cdFx0dGhpcy5fcGFuWSArPSBkeTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBNYWtlIHtHcmFwaH0gcGFubmFibGVcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0cGFubmFibGUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9wYW5uYWJsZSA9IHRydWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE1ha2VzIHRoZSBncmFwaCBwYW4gaW4gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbiBvZiB0aGUgbW91c2UgYXMgb3Bwb3NlZCB0byB3aXRoIGl0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGludmVydFBhbiA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX2ludmVydGVkUGFuID0gLTE7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE1ha2Ugbm9kZXMgaW4ge0dyYXBofSByZXBvaXNpdGlvbmFibGUgYnkgY2xpY2stZHJhZ2dpbmdcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0ZHJhZ2dhYmxlIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5fZHJhZ2dhYmxlID0gdHJ1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRfZ2V0Wm9vbUZvckxldmVsIDogZnVuY3Rpb24obGV2ZWwpIHtcblx0XHR2YXIgZmFjdG9yID0gTWF0aC5wb3coMS41ICwgTWF0aC5hYnMobGV2ZWwgLSB0aGlzLl96b29tTGV2ZWwpKTtcblx0XHRpZiAobGV2ZWwgPCB0aGlzLl96b29tTGV2ZWwpIHtcblx0XHRcdGZhY3RvciA9IDEvZmFjdG9yO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFjdG9yO1xuXHR9LFxuXG5cdF96b29tIDogZnVuY3Rpb24oZmFjdG9yLHgseSkge1xuXHRcdHRoaXMuX3pvb21TY2FsZSAqPSBmYWN0b3I7XG5cdFx0dGhpcy5fbGF5b3V0ZXIuX3pvb21TY2FsZSA9IHRoaXMuX3pvb21TY2FsZTtcblxuXHRcdC8vIFBhbiBzY2VuZSBiYWNrIHRvIG9yaWdpblxuXHRcdHZhciBvcmlnaW5hbFggPSB0aGlzLl9zY2VuZS54O1xuXHRcdHZhciBvcmlnaW5hbFkgPSB0aGlzLl9zY2VuZS55O1xuXHRcdHRoaXMuX3BhbigtdGhpcy5fc2NlbmUueCwtdGhpcy5fc2NlbmUueSk7XG5cblx0XHR2YXIgbW91c2VYID0geCB8fCAwO1xuXHRcdHZhciBtb3VzZVkgPSB5IHx8IDA7XG5cblx0XHQvLyAnWm9vbScgbm9kZXMuICAgV2UgZG8gdGhpcyBzbyB0ZXh0L3JhZGl1cyBzaXplIHJlbWFpbnMgY29uc2lzdGVudCBhY3Jvc3Mgem9vbSBsZXZlbHNcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX25vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR0aGlzLl9sYXlvdXRlci5fc2V0Tm9kZVBvc2l0aW9uKHRoaXMuX25vZGVzW2ldLHRoaXMuX25vZGVzW2ldLngqZmFjdG9yLCB0aGlzLl9ub2Rlc1tpXS55KmZhY3Rvcix0cnVlKTtcblx0XHR9XG5cblx0XHQvLyBab29tIHRoZSByZW5kZXIgZ3JvdXBzXG5cdFx0dGhpcy5fYWRkUHJlQW5kUG9zdFJlbmRlck9iamVjdHMoKTtcblxuXG5cdFx0Ly8gUmV2ZXJzZSB0aGUgJ29yaWdpbiBwYW4nIHdpdGggdGhlIHNjYWxlIGFwcGxpZWQgYW5kIHJlY2VudGVyIHRoZSBtb3VzZSB3aXRoIHNjYWxlIGFwcGxpZWQgYXMgd2VsbFxuXHRcdHZhciBuZXdNb3VzZVggPSBtb3VzZVgqZmFjdG9yO1xuXHRcdHZhciBuZXdNb3VzZVkgPSBtb3VzZVkqZmFjdG9yO1xuXHRcdHRoaXMuX3BhbihvcmlnaW5hbFgqZmFjdG9yIC0gKG5ld01vdXNlWC1tb3VzZVgpLG9yaWdpbmFsWSpmYWN0b3IgLSAobmV3TW91c2VZLW1vdXNlWSkpO1xuXG5cblx0XHQvLyBVcGRhdGUgdGhlIHJlZ3JvdXAgdW5kZXJsYXlzXG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGlmICh0aGlzLl9oYW5kbGVHcm91cCAmJiB0aGlzLl9oYW5kbGVHcm91cC5jaGlsZHJlbiAmJiB0aGlzLl9oYW5kbGVHcm91cC5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2hhbmRsZUdyb3VwLnJlbW92ZUFsbCgpO1xuXHRcdFx0dGhhdC5fc2NlbmUudXBkYXRlKCk7XG5cdFx0XHR0aGF0Ll9hZGRSZWdyb3VwSGFuZGxlcygpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogTWFrZSB7R3JhcGh9IHpvb21hYmxlIGJ5IHVzaW5nIHRoZSBtb3VzZXdoZWVsXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdHpvb21hYmxlIDogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF0aGlzLl96b29tYWJsZSkge1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCh0aGlzLl9jYW52YXMpLm9uKCdtb3VzZXdoZWVsJyxmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciB3aGVlbCA9IGUub3JpZ2luYWxFdmVudC53aGVlbERlbHRhLzEyMDsvL24gb3IgLW5cblx0XHRcdFx0dmFyIGZhY3Rvcjtcblx0XHRcdFx0aWYgKHdoZWVsIDwgMCkge1xuXHRcdFx0XHRcdGZhY3RvciA9IHRoYXQuX2dldFpvb21Gb3JMZXZlbCh0aGF0Ll96b29tTGV2ZWwtMSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZmFjdG9yID0gdGhhdC5fZ2V0Wm9vbUZvckxldmVsKHRoYXQuX3pvb21MZXZlbCsxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGF0Ll96b29tKGZhY3RvciwgZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3pvb21hYmxlID0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGxheW91dCBmdW5jdGlvbiBmb3IgdGhlIG5vZGVzXG5cdCAqIEBwYXJhbSBsYXlvdXRlciAtIEFuIGluc3RhbmNlIChvciBzdWJjbGFzcykgb2YgTGF5b3V0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaXMgbGF5b3V0ZXIgcGFyYW0gaXMgZGVmaW5lZCwgdGhlIGxheW91dGVyIG90aGVyd2lzZVxuXHQgKi9cblx0bGF5b3V0ZXIgOiBmdW5jdGlvbihsYXlvdXRlcikge1xuXHRcdGlmIChsYXlvdXRlcikge1xuXHRcdFx0dGhpcy5fbGF5b3V0ZXIgPSBsYXlvdXRlcjtcblx0XHRcdHRoaXMuX2xheW91dGVyXG5cdFx0XHRcdC5ub2Rlcyh0aGlzLl9ub2Rlcylcblx0XHRcdFx0LmxpbmtNYXAodGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSlcblx0XHRcdFx0Lm5vZGVNYXAodGhpcy5fbm9kZUluZGV4VG9DaXJjbGUpXG5cdFx0XHRcdC5sYWJlbE1hcCh0aGlzLl9ub2RlSW5kZXhUb0xhYmVsKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xheW91dGVyO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogUGVyZm9ybXMgYSBsYXlvdXQgb2YgdGhlIGdyYXBoXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGxheW91dCA6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0aWYgKHRoaXMuX2xheW91dGVyKSB7XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLl9sYXlvdXRlci5sYXlvdXQodGhpcy5fY2FudmFzLndpZHRoLHRoaXMuX2NhbnZhcy5oZWlnaHQsY2FsbGJhY2spO1xuXG5cblx0XHRcdC8vIFVwZGF0ZSB0aGUgcmVncm91cCB1bmRlcmxheXNcblx0XHRcdGlmICh0aGlzLl9oYW5kbGVHcm91cCAmJiB0aGlzLl9oYW5kbGVHcm91cC5jaGlsZHJlbikge1xuXHRcdFx0XHR2YXIgdW5kZXJsYXlzID0gdGhpcy5faGFuZGxlR3JvdXAuY2hpbGRyZW47XG5cdFx0XHRcdHVuZGVybGF5cy5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZU9iamVjdCkge1xuXHRcdFx0XHRcdHZhciBpbmRpY2VzID0gaGFuZGxlT2JqZWN0LmdyYXBoanNfaW5kaWNlcztcblx0XHRcdFx0XHR2YXIgYmIgPSB0aGF0Ll9sYXlvdXRlci5nZXRCb3VuZGluZ0JveChpbmRpY2VzLCBSRUdST1VORF9CQl9QQURESU5HKTtcblx0XHRcdFx0XHRpZiAoaGFuZGxlT2JqZWN0LmdyYXBoanNfdHlwZSA9PT0gJ3JlZ3JvdXBfdW5kZXJsYXknKSB7XG5cdFx0XHRcdFx0XHRoYW5kbGVPYmplY3QudHdlZW5BdHRyKHtcblx0XHRcdFx0XHRcdFx0eDogYmIueCxcblx0XHRcdFx0XHRcdFx0eTogYmIueSxcblx0XHRcdFx0XHRcdFx0d2lkdGg6IGJiLndpZHRoLFxuXHRcdFx0XHRcdFx0XHRoZWlnaHQ6IGJiLmhlaWdodFxuXHRcdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0XHRkdXJhdGlvbjogdGhhdC5fbGF5b3V0ZXIuZHVyYXRpb24oKSxcblx0XHRcdFx0XHRcdFx0ZWFzaW5nOiB0aGF0Ll9sYXlvdXRlci5lYXNpbmcoKVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChoYW5kbGVPYmplY3QuZ3JhcGhqc190eXBlID09PSAncmVncm91cF9pY29uJykge1xuXHRcdFx0XHRcdFx0dmFyIHVuZ3JvdXBlZE5vZGVzID0gdGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLmdldFVuZ3JvdXBlZE5vZGVzRm9yS2V5KGhhbmRsZU9iamVjdC5ncmFwaGpzX2dyb3VwX2tleSk7XG5cdFx0XHRcdFx0XHR2YXIgaWNvblBvc2l0aW9uID0gdGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLmdldE1pbmltaXplSWNvblBvc2l0aW9uKGJiLHVuZ3JvdXBlZE5vZGVzKTtcblx0XHRcdFx0XHRcdGhhbmRsZU9iamVjdC50d2VlbkF0dHIoe1xuXHRcdFx0XHRcdFx0XHR4OiBpY29uUG9zaXRpb24ueCxcblx0XHRcdFx0XHRcdFx0eTogaWNvblBvc2l0aW9uLnlcblx0XHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdFx0ZHVyYXRpb246IHRoYXQuX2xheW91dGVyLmR1cmF0aW9uKCksXG5cdFx0XHRcdFx0XHRcdGVhc2luZzogdGhhdC5fbGF5b3V0ZXIuZWFzaW5nKClcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZ3JvdXBpbmcgbWFuYWdlci5cblx0ICogQHBhcmFtIGdyb3VwaW5nTWFuYWdlclxuXHQgKiBAcmV0dXJucyB7Kn1cblx0ICovXG5cdGdyb3VwaW5nTWFuYWdlciA6IGZ1bmN0aW9uKGdyb3VwaW5nTWFuYWdlcikge1xuXHRcdGlmIChncm91cGluZ01hbmFnZXIpIHtcblx0XHRcdHRoaXMuX2dyb3VwaW5nTWFuYWdlciA9IGdyb3VwaW5nTWFuYWdlcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2dyb3VwaW5nTWFuYWdlcjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemVzIHRoZSBncm91cGluZyBtYW5hZ2VyIHByb3ZpZGVkIGFuZCBjYWxscyB0aGUgbWV0aG9kcyBmb3IgYWdncmVnYXRpbmcgbm9kZXMgYW5kIGxpbmtzXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGluaXRpYWxpemVHcm91cGluZyA6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLl9ncm91cGluZ01hbmFnZXIpIHtcblxuXHRcdFx0dGhpcy5fbm9kZXMuZm9yRWFjaChmdW5jdGlvbihub2RlKSB7XG5cdFx0XHRcdG5vZGUucGFyZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX2dyb3VwaW5nTWFuYWdlci5ub2Rlcyh0aGlzLl9ub2Rlcylcblx0XHRcdFx0LmxpbmtzKHRoaXMuX2xpbmtzKVxuXHRcdFx0XHQuaW5pdGlhbGl6ZUhlaXJhcmNoeSgpO1xuXG5cdFx0XHR0aGlzLm5vZGVzKHRoaXMuX2dyb3VwaW5nTWFuYWdlci5hZ2dyZWdhdGVkTm9kZXMoKSk7XG5cdFx0XHR0aGlzLmxpbmtzKHRoaXMuX2dyb3VwaW5nTWFuYWdlci5hZ2dyZWdhdGVkTGlua3MoKSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBVbmdyb3VwcyB0aGUgcHJvZGlkZWQgYWdncmVnYXRlIG5vZGVcblx0ICogQHBhcmFtIG5vZGUgLSB0aGUgYWdncmVnYXRlIG5vZGUgdG8gYmUgdW5ncm91cGVkXG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdHVuZ3JvdXAgOiBmdW5jdGlvbihub2RlKSB7XG5cdFx0aWYgKCFub2RlIHx8ICFub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGlmICh0aGlzLl9ncm91cGluZ01hbmFnZXIpIHtcblx0XHRcdHRoaXMuX2dyb3VwaW5nTWFuYWdlci51bmdyb3VwKG5vZGUpO1xuXHRcdFx0dGhpcy5jbGVhcigpXG5cdFx0XHRcdC5ub2Rlcyh0aGlzLl9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZE5vZGVzKCkpXG5cdFx0XHRcdC5saW5rcyh0aGlzLl9ncm91cGluZ01hbmFnZXIuYWdncmVnYXRlZExpbmtzKCkpXG5cdFx0XHRcdC5kcmF3KCk7XG5cblx0XHRcdHRoaXMuX2xheW91dGVyLl9hcHBseVpvb21TY2FsZSh0cnVlKTtcblx0XHRcdHRoaXMubGF5b3V0KCk7XG5cdFx0XHR0aGlzLl9sYXlvdXRlci5fYXBwbHlab29tU2NhbGUoZmFsc2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogUmVncm91cHMgdGhlIGFnZ3JlZ2F0ZSBub2RlLiAgIENhbiBiZSBjYWxsZWQgcHJvZ3JhbWF0dGljYWxseSBidXQgaXMgYXV0b21hdGljYWxseSBpbnZva2VkIHdoZW4gY2xpY2tpbmcgb24gdGhlXG5cdCAqIHJlZ3JvdXAgaGFuZGxlclxuXHQgKiBAcGFyYW0gdW5ncm91cGVkQWdncmVnYXRlS2V5XG5cdCAqL1xuXHRyZWdyb3VwIDogZnVuY3Rpb24odW5ncm91cGVkQWdncmVnYXRlS2V5KSB7XG5cdFx0Ly8gQW5pbWF0ZSB0aGUgcmVncm91cFxuXHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHR2YXIgcGFyZW50QWdncmVnYXRlID0gdGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmdldEFnZ3JlZ2F0ZSh1bmdyb3VwZWRBZ2dyZWdhdGVLZXkpO1xuXG5cdFx0dmFyIGF2Z1BvcyA9IHsgeDogMCwgeSA6IDB9O1xuXHRcdHZhciBtYXhSYWRpdXMgPSAwO1xuXHRcdHBhcmVudEFnZ3JlZ2F0ZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG5cdFx0XHRhdmdQb3MueCArPSBjaGlsZC54O1xuXHRcdFx0YXZnUG9zLnkgKz0gY2hpbGQueTtcblx0XHR9KTtcblx0XHRhdmdQb3MueCAvPSBwYXJlbnRBZ2dyZWdhdGUuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdGF2Z1Bvcy55IC89IHBhcmVudEFnZ3JlZ2F0ZS5jaGlsZHJlbi5sZW5ndGg7XG5cblx0XHR2YXIgaW5kZXhPZkNoaWxkcmVuID0gcGFyZW50QWdncmVnYXRlLmNoaWxkcmVuLm1hcChmdW5jdGlvbihjaGlsZCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB0aGF0Ll9ncm91cGluZ01hbmFnZXIuX2FnZ3JlZ2F0ZWROb2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLl9hZ2dyZWdhdGVkTm9kZXNbaV0uaW5kZXggPT09IGNoaWxkLmluZGV4KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHR2YXIgbWluQ2hpbGRJbmRleCA9IE51bWJlci5NQVhfVkFMVUU7XG5cdFx0aW5kZXhPZkNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oaWR4KSB7XG5cdFx0XHRtaW5DaGlsZEluZGV4ID0gTWF0aC5taW4obWluQ2hpbGRJbmRleCxpZHgpO1xuXHRcdH0pO1xuXG5cdFx0dmFyIGFuaW1hdGVkUmVncm91cGVkID0gMDtcblx0XHR0aGlzLl9zdXNwZW5kRXZlbnRzKCk7XHRcdFx0Ly8gbGF5b3V0IHdpbGwgcmVzdW1lIHRoZW1cblx0XHRwYXJlbnRBZ2dyZWdhdGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuXG5cdFx0XHQvL1RPRE86ICAgV2hlbiB3ZSBjYW4gc3VwcG9ydCB0cmFuc3BhcmVudCB0ZXh0IGluIHBhdGgsIGZhZGUgb3V0IHRoZSBsYWJlbCBhcyB3ZSBtb3ZlIGl0IHRvZ2V0aGVyIGlmIGl0J3Mgc2hvd2luZ1xuXHRcdFx0dGhhdC5yZW1vdmVMYWJlbChjaGlsZCk7XG5cdFx0XHR0aGF0Ll9sYXlvdXRlci5fc2V0Tm9kZVBvc2l0aW9uKGNoaWxkLGF2Z1Bvcy54LGF2Z1Bvcy55LGZhbHNlLGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhbmltYXRlZFJlZ3JvdXBlZCsrO1xuXHRcdFx0XHRpZiAoYW5pbWF0ZWRSZWdyb3VwZWQgPT09IHBhcmVudEFnZ3JlZ2F0ZS5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdFx0XHRpZiAodGhhdC5fZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0XHRcdFx0XHR2YXIgcmVncm91cGVkQWdncmVnYXRlID0gdGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLnJlZ3JvdXAodW5ncm91cGVkQWdncmVnYXRlS2V5LG1pbkNoaWxkSW5kZXgpO1xuXHRcdFx0XHRcdFx0cmVncm91cGVkQWdncmVnYXRlLnggPSBhdmdQb3MueDtcblx0XHRcdFx0XHRcdHJlZ3JvdXBlZEFnZ3JlZ2F0ZS55ID0gYXZnUG9zLnk7XG5cdFx0XHRcdFx0XHR0aGF0LmNsZWFyKClcblx0XHRcdFx0XHRcdFx0Lm5vZGVzKHRoYXQuX2dyb3VwaW5nTWFuYWdlci5hZ2dyZWdhdGVkTm9kZXMoKSlcblx0XHRcdFx0XHRcdFx0LmxpbmtzKHRoYXQuX2dyb3VwaW5nTWFuYWdlci5hZ2dyZWdhdGVkTGlua3MoKSk7XG5cdFx0XHRcdFx0XHR0aGF0LmRyYXcoKTtcblx0XHRcdFx0XHRcdHRoYXQuX2xheW91dGVyLl9hcHBseVpvb21TY2FsZSh0cnVlKTtcblx0XHRcdFx0XHRcdHRoYXQubGF5b3V0KCk7XG5cdFx0XHRcdFx0XHR0aGF0Ll9sYXlvdXRlci5fYXBwbHlab29tU2NhbGUoZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBmb250IHNpemUgZm9yIGxhYmVsc1xuXHQgKiBAcGFyYW0gZm9udFNpemUgLSBzaXplIG9mIHRoZSBmb250IGluIHBpeGVsc1xuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGZvbnRTaXplIHBhcmFtIGlzIGRlaWZuZWQsIHtHcmFwaC5fZm9udFNpemV9IG90aGVyd2lzZVxuXHQgKi9cblx0Zm9udFNpemUgOiBmdW5jdGlvbihmb250U2l6ZSkge1xuXHRcdGlmIChmb250U2l6ZSkge1xuXHRcdFx0dGhpcy5fZm9udFNpemUgPSBmb250U2l6ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZvbnRTaXplO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBmb250IGNvbG91ciBmb3IgbGFiZWxzXG5cdCAqIEBwYXJhbSBmb250Q29sb3VyIC0gQSBoZXggc3RyaW5nIGZvciB0aGUgY29sb3VyIG9mIHRoZSBsYWJlbHNcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBmb250Q29sb3VyIHBhcmFtIGlzIGRlaWZuZWQsIHtHcmFwaC5fZm9udENvbG91cn0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRmb250Q29sb3VyIDogZnVuY3Rpb24oZm9udENvbG91cikge1xuXHRcdGlmIChmb250Q29sb3VyKSB7XG5cdFx0XHR0aGlzLl9mb250Q29sb3IgPSBmb250Q29sb3VyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZm9udENvbG9yO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBmb250IHN0cm9rZSBmb3IgbGFiZWxzXG5cdCAqIEBwYXJhbSBmb250U3Ryb2tlIC0gQSBoZXggc3RyaW5nIGZvciB0aGUgY29sb3Igb2YgdGhlIGxhYmVsIHN0cm9rZVxuXHQgKiBAcmV0dXJucyB7R3JhcGh9IGlmIGZvbnRTdHJva2UgcGFyYW0gaXMgZGVmaW5lZCwge0dyYXBoLl9mb250U3Ryb2tlfSBvdGhlcndpc2Vcblx0ICovXG5cdGZvbnRTdHJva2UgOiBmdW5jdGlvbihmb250U3Ryb2tlKSB7XG5cdFx0aWYgKGZvbnRTdHJva2UpIHtcblx0XHRcdHRoaXMuX2ZvbnRTdHJva2UgPSBmb250U3Ryb2tlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZm9udFN0cm9rZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZm9udCBzdHJva2Ugd2lkdGggZm9yIGxhYmVsc1xuXHQgKiBAcGFyYW0gZm9udFN0cm9rZVdpZHRoIC0gc2l6ZSBpbiBwaXhlbHNcblx0ICogQHJldHVybnMge0dyYXBofSBpZiBmb250U3Ryb2tlV2lkdGggcGFyYW0gaXMgZGVmaW5lZCwge0dyYXBoLl9mb250U3Ryb2tlV2lkdGh9IG90aGVyd2lzZVxuXHQgKi9cblx0Zm9udFN0cm9rZVdpZHRoIDogZnVuY3Rpb24oZm9udFN0cm9rZVdpZHRoKSB7XG5cdFx0aWYgKGZvbnRTdHJva2VXaWR0aCkge1xuXHRcdFx0dGhpcy5fZm9udFN0cm9rZVdpZHRoID0gZm9udFN0cm9rZVdpZHRoO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZm9udFN0cm9rZVdpZHRoO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBmb250IGZhbWlseSBmb3IgbGFiZWxzXG5cdCAqIEBwYXJhbSBmb250RmFtaWx5IC0gQSBzdHJpbmcgZm9yIHRoZSBmb250IGZhbWlseSAoYSBsYSBIVE1MNSBDYW52YXMpXG5cdCAqIEByZXR1cm5zIHtHcmFwaH0gaWYgZm9udEZhbWlseSBwYXJhbSBpcyBkZWlmbmVkLCB7R3JhcGguX2ZvbnRGYW1pbHl9IG90aGVyd2lzZVxuXHQgKi9cblx0Zm9udEZhbWlseSA6IGZ1bmN0aW9uKGZvbnRGYW1pbHkpIHtcblx0XHRpZiAoZm9udEZhbWlseSkge1xuXHRcdFx0dGhpcy5fZm9udEZhbWlseSA9IGZvbnRGYW1pbHk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb250RmFtaWx5O1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogR2V0cy9zZXRzIHRoZSBmb250IHNoYWRvdyBwcm9wZXJ0aWVzIGZvciBsYWJlbHNcblx0ICogQHBhcmFtIGNvbG9yIC0gdGhlIGNvbG91ciBvZiB0aGUgc2hhZG93XG5cdCAqIEBwYXJhbSBvZmZzZXRYIC0gdGhlIHggb2Zmc2V0IG9mIHRoZSBzaGFkb3cgZnJvbSBjZW50ZXJcblx0ICogQHBhcmFtIG9mZnNldFkgLSB0aGUgeSBvZmZzZXQgb2YgdGhlIHNoYWRvdyBmcm9tIGNlbnRlclxuXHQgKiBAcGFyYW0gYmx1ciAtIHRoZSBhbW91bnQgb2YgYmx1ciBhcHBsaWVkIHRvIHRoZSBzaGFkb3cgaW4gcGl4ZWxzXG5cdCAqIEByZXR1cm5zIHsqfVxuXHQgKi9cblx0Zm9udFNoYWRvdyA6IGZ1bmN0aW9uKGNvbG9yLG9mZnNldFgsb2Zmc2V0WSxibHVyKSB7XG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNvbG9yOiB0aGlzLl9zaGFkb3dDb2xvcixcblx0XHRcdFx0b2Zmc2V0WDogdGhpcy5fc2hhZG93T2Zmc2V0WCxcblx0XHRcdFx0b2Zmc2V0WTogdGhpcy5fc2hhZG93T2Zmc2V0WSxcblx0XHRcdFx0Ymx1cjogdGhpcy5fc2hhZG93Qmx1clxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2hhZG93Q29sb3IgPSBjb2xvcjtcblx0XHRcdHRoaXMuX3NoYWRvd09mZnNldFggPSBvZmZzZXRYO1xuXHRcdFx0dGhpcy5fc2hhZG93T2Zmc2V0WSA9IG9mZnNldFk7XG5cdFx0XHR0aGlzLl9zaGFkb3dCbHVyID0gYmx1cjtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogUmVzaXplIHRoZSBncmFwaC4gIEF1dG9tYXRpY2FsbHkgcGVyZm9ybXMgbGF5b3V0IGFuZCByZXJlbmRlcnMgdGhlIGdyYXBoXG5cdCAqIEBwYXJhbSB3IC0gdGhlIG5ldyB3aWR0aFxuXHQgKiBAcGFyYW0gaCAtIHRoZSBuZXcgaGVpZ2h0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdHJlc2l6ZSA6IGZ1bmN0aW9uKHcsaCkge1xuXHRcdHRoaXMuX3dpZHRoID0gdztcblx0XHR0aGlzLl9oZWlnaHQgPSBoO1xuXHRcdCQodGhpcy5fY2FudmFzKS5hdHRyKHt3aWR0aDp3LGhlaWdodDpofSlcblx0XHRcdC53aWR0aCh3KVxuXHRcdFx0LmhlaWdodChoKTtcblx0XHR0aGlzLl9zY2VuZS5yZXNpemUodyxoKTtcblxuXHRcdGlmICghdGhpcy5fcGFubmFibGUgJiYgIXRoaXMuX3pvb21hYmxlKSB7XG5cdFx0XHR0aGlzLmxheW91dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zY2VuZS51cGRhdGUoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldHMgYSBsaXN0IG9mIHByZS9wb3N0IHJlbmRlciBvYmplY3RzIGZyb20gdGhlIGxheW91dGVyIChpZiBhbnkpXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfYWRkUHJlQW5kUG9zdFJlbmRlck9iamVjdHMgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9wcmVyZW5kZXJHcm91cC5yZW1vdmVBbGwoKTtcblxuXHRcdC8vIEdldCB0aGUgYmFja2dyb3VuZCBvYmplY3RzIGZyb20gdGhlIGxheW91dGVyXG5cdFx0dmFyIG9ianMgPSB0aGlzLl9sYXlvdXRlci5wcmVyZW5kZXIodGhpcy5fd2lkdGgsdGhpcy5faGVpZ2h0KTtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0aWYgKG9ianMpIHtcblx0XHRcdG9ianMuZm9yRWFjaChmdW5jdGlvbihyZW5kZXJPYmplY3QpIHtcblx0XHRcdFx0dGhhdC5fcHJlcmVuZGVyR3JvdXAuYWRkQ2hpbGQocmVuZGVyT2JqZWN0KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Bvc3RyZW5kZXJHcm91cC5yZW1vdmVBbGwoKTtcblx0XHRvYmpzID0gdGhpcy5fbGF5b3V0ZXIucG9zdHJlbmRlcih0aGlzLl93aWR0aCx0aGlzLl9oZWlnaHQpO1xuXHRcdGlmIChvYmpzKSB7XG5cdFx0XHRvYmpzLmZvckVhY2goZnVuY3Rpb24ocmVuZGVyT2JqZWN0KSB7XG5cdFx0XHRcdHRoYXQuX3Bvc3RyZW5kZXJHcm91cC5hZGRDaGlsZChyZW5kZXJPYmplY3QpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGNsaWNrYWJsZSBib3hlcyB0byByZWdyb3VwIGFueSB1bmdyb3VwZWQgYWdncmVnYXRlc1xuXHQgKiBUT0RPOiAgbWFrZSB0aGlzIGxvb2sgYmV0dGVyIVxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2FkZFJlZ3JvdXBIYW5kbGVzIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdGlmICh0aGlzLl9ncm91cGluZ01hbmFnZXIpIHtcblx0XHRcdHZhciB1bmdyb3VwZWROb2Rlc0luZm8gPSB0aGlzLl9ncm91cGluZ01hbmFnZXIuZ2V0VW5ncm91cGVkTm9kZXMoKTtcblx0XHRcdHVuZ3JvdXBlZE5vZGVzSW5mby5mb3JFYWNoKGZ1bmN0aW9uKHVuZ3JvdXBlZE5vZGVJbmZvKSB7XG5cdFx0XHRcdHZhciBpbmRpY2VzID0gdW5ncm91cGVkTm9kZUluZm8uaW5kaWNlcztcblx0XHRcdFx0dmFyIGtleSA9IHVuZ3JvdXBlZE5vZGVJbmZvLmtleTtcblx0XHRcdFx0dmFyIGJib3ggPSB0aGF0Ll9sYXlvdXRlci5nZXRCb3VuZGluZ0JveChpbmRpY2VzLFJFR1JPVU5EX0JCX1BBRERJTkcpO1xuXHRcdFx0XHR2YXIgaWNvblBvc2l0aW9uID0gdGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLmdldE1pbmltaXplSWNvblBvc2l0aW9uKGJib3gsdGhhdC5fZ3JvdXBpbmdNYW5hZ2VyLmdldFVuZ3JvdXBlZE5vZGVzRm9yS2V5KGtleSkpO1xuXHRcdFx0XHR2YXIgbWluaW1pemVSZW5kZXJPYmplY3QgPSBwYXRoLmltYWdlKHtcblx0XHRcdFx0XHRzcmMgOiAnZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFCUUFBQUFVQ0FZQUFBQ05pUjBOQUFBQUFYTlNSMElBcnM0YzZRQUFBQWx3U0ZsekFBRVFoQUFCRUlRQlAwVkZZQUFBQWN0cFZGaDBXRTFNT21OdmJTNWhaRzlpWlM1NGJYQUFBQUFBQUR4NE9uaHRjRzFsZEdFZ2VHMXNibk02ZUQwaVlXUnZZbVU2Ym5NNmJXVjBZUzhpSUhnNmVHMXdkR3M5SWxoTlVDQkRiM0psSURVdU5DNHdJajRLSUNBZ1BISmtaanBTUkVZZ2VHMXNibk02Y21SbVBTSm9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHhPVGs1THpBeUx6SXlMWEprWmkxemVXNTBZWGd0Ym5NaklqNEtJQ0FnSUNBZ1BISmtaanBFWlhOamNtbHdkR2x2YmlCeVpHWTZZV0p2ZFhROUlpSUtJQ0FnSUNBZ0lDQWdJQ0FnZUcxc2JuTTZlRzF3UFNKb2RIUndPaTh2Ym5NdVlXUnZZbVV1WTI5dEwzaGhjQzh4TGpBdklnb2dJQ0FnSUNBZ0lDQWdJQ0I0Yld4dWN6cDBhV1ptUFNKb2RIUndPaTh2Ym5NdVlXUnZZbVV1WTI5dEwzUnBabVl2TVM0d0x5SStDaUFnSUNBZ0lDQWdJRHg0YlhBNlEzSmxZWFJ2Y2xSdmIydytkM2QzTG1sdWEzTmpZWEJsTG05eVp6d3ZlRzF3T2tOeVpXRjBiM0pVYjI5c1Bnb2dJQ0FnSUNBZ0lDQThkR2xtWmpwUGNtbGxiblJoZEdsdmJqNHhQQzkwYVdabU9rOXlhV1Z1ZEdGMGFXOXVQZ29nSUNBZ0lDQThMM0prWmpwRVpYTmpjbWx3ZEdsdmJqNEtJQ0FnUEM5eVpHWTZVa1JHUGdvOEwzZzZlRzF3YldWMFlUNEtHTXRWV0FBQUFjaEpSRUZVT0JHVmxUMU93MEFRUnIyMlE1UklFUVZDUkVwRHJvQ1ZHbzVBUTA5THpRRWlEc0FSS0RnQlZ3Z2RVcUtjZ0lZbUVxSkNsdmhOYk41bmVZTzlzVTBZYVZqdjdMZHZacHoxWWp4c05Cb2RyMWFySzJQTUVkTWVuaXEraFJrMGNacW04eUFJeHRQcDlONElSbURpKzc0SFZJd21tQUN5b3NZQTg1SWs4U2pvSk9qMys3Y0VEb0c5SVF3emVmMGZDeXdwS09nZFJndkcwRmViZVdXZGtxcCtVcXpPcWpwaWlPVVRxWHRubGRWWVFzV29SRDBCcXpKS1h4ZlhXcDJsQXY3SC9reFNCTm9XM2JHWTBGMno4N1dtQ0xUWjNYRXQ1c0ZkMDd3RUxRS0xHLy96YkpOa2U2ck9YZUptYmFBTFZpcXFDTXdXK1dLQ0JzREdrcjRRYkYyRUJhWWNTcDhULzRwZklucEd0RU1zWWM1Z1NtMFJVMVZmSkQ5Z3ZHWjlsMWdHdGNDRW9JQ1BzOW5zQnRIV0ZrWFJCWHVqSEJpVStvZlMzcHIwS3l6dE1XUlFPeXBYOENWK2g3L2dMYmRWWXBsUmpZN0tONzZQbitJdFBHT281UmpYOTZ4QXlLMXhCc2hqRTlONnM1cjhZckVGeFNFYjUyRVk2b0w5Wkh1Yk1ic1U2MUViS3pvVkh4VFNYUzZYYzUrSHNYNTZSbDFmYWx0VnF3VjNWTXgxYWNUbzVveHhzRmdzbmdhRHdZVENoclN4aDBBdnVibGZCTG5wWGNiQUhqaEM1L29YOEFQc0Nhdjl0SDZYWFFBQUFBQkpSVTVFcmtKZ2dnPT0nLFxuXHRcdFx0XHRcdHggOiBpY29uUG9zaXRpb24ueCxcblx0XHRcdFx0XHR5IDogaWNvblBvc2l0aW9uLnksXG5cdFx0XHRcdFx0Z3JhcGhqc190eXBlIDogJ3JlZ3JvdXBfaWNvbicsXG5cdFx0XHRcdFx0Z3JhcGhqc19pbmRpY2VzIDogaW5kaWNlcyxcblx0XHRcdFx0XHRncmFwaGpzX2dyb3VwX2tleSA6IGtleSxcblx0XHRcdFx0XHRvcGFjaXR5IDogMC44XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHZhciBib3VuZGluZ0JveFJlbmRlck9iamVjdCA9IHBhdGgucmVjdCh7XG5cdFx0XHRcdFx0eCA6IGJib3gueCxcblx0XHRcdFx0XHR5IDogYmJveC55LFxuXHRcdFx0XHRcdGdyYXBoanNfdHlwZSA6ICdyZWdyb3VwX3VuZGVybGF5Jyxcblx0XHRcdFx0XHRncmFwaGpzX2luZGljZXMgOiBpbmRpY2VzLFxuXHRcdFx0XHRcdHdpZHRoIDogYmJveC53aWR0aCxcblx0XHRcdFx0XHRoZWlnaHQgOiBiYm94LmhlaWdodCxcblx0XHRcdFx0XHRzdHJva2VTdHlsZSA6ICcjMjMyMzIzJyxcblx0XHRcdFx0XHRmaWxsU3R5bGUgOiAnIzAwMDAwMCcsXG5cdFx0XHRcdFx0b3BhY2l0eSA6IDAuMVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0bWluaW1pemVSZW5kZXJPYmplY3Qub24oJ2NsaWNrJyxmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LnJlZ3JvdXAoa2V5KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoYXQuX2hhbmRsZUdyb3VwLmFkZENoaWxkKG1pbmltaXplUmVuZGVyT2JqZWN0KTtcblx0XHRcdFx0dGhhdC5faGFuZGxlR3JvdXAuYWRkQ2hpbGQoYm91bmRpbmdCb3hSZW5kZXJPYmplY3QpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9zY2VuZS51cGRhdGUoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlZHJhdyB0aGUgZ3JhcGhcblx0ICogQHJldHVybnMge0dyYXBofVxuXHQgKi9cblx0dXBkYXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRvcCA9IC10aGlzLl9zY2VuZS55O1xuXHRcdHZhciBsZWZ0ID0gLXRoaXMuX3NjZW5lLng7XG5cblx0XHR0aGlzLl9sYXlvdXRlci5wb3N0cmVuZGVyVXBkYXRlKGxlZnQsdG9wLGxlZnQrdGhpcy5fc2NlbmUud2lkdGgsdG9wK3RoaXMuX3NjZW5lLmhlaWdodCk7XG5cdFx0dGhpcy5fc2NlbmUudXBkYXRlKCk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIERyYXcgdGhlIGdyYXBoLiAgIE9ubHkgbmVlZHMgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBub2Rlcy9saW5rcyBoYXZlIGJlZW4gc2V0XG5cdCAqIEByZXR1cm5zIHtHcmFwaH1cblx0ICovXG5cdGRyYXcgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRpZiAoIXRoaXMuX3NjZW5lKSB7XG5cdFx0XHR0aGlzLl9zY2VuZSA9IHBhdGgodGhpcy5fY2FudmFzKTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9sYXlvdXRlcikge1xuXHRcdFx0dmFyIGRlZmF1bExheW91dCA9IG5ldyBMYXlvdXQoKVxuXHRcdFx0XHQubm9kZXModGhpcy5fbm9kZXMpXG5cdFx0XHRcdC5ub2RlTWFwKHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlKVxuXHRcdFx0XHQubGlua01hcCh0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lKVxuXHRcdFx0XHQubGFiZWxNYXAodGhpcy5fbm9kZUluZGV4VG9MYWJlbCk7XG5cdFx0XHR0aGlzLmxheW91dGVyKGRlZmF1bExheW91dCk7XG5cdFx0fVxuXHRcdHRoaXMuX3ByZXJlbmRlckdyb3VwID0gcGF0aC5ncm91cCgpO1xuXHRcdHRoaXMuX2hhbmRsZUdyb3VwID0gcGF0aC5ncm91cCgpO1xuXHRcdHRoaXMuX3Bvc3RyZW5kZXJHcm91cCA9IHBhdGguZ3JvdXAoe25vSGl0OnRydWV9KTtcblxuXG5cdFx0dGhpcy5fc2NlbmUuYWRkQ2hpbGQodGhpcy5fcHJlcmVuZGVyR3JvdXApO1xuXHRcdHRoaXMuX3NjZW5lLmFkZENoaWxkKHRoaXMuX2hhbmRsZUdyb3VwKTtcblx0XHR0aGlzLl9saW5rcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmspIHtcblxuXHRcdFx0dmFyIGxpbmtPYmplY3Q7XG5cdFx0XHRpZiAoIWxpbmsudHlwZSkge1xuXHRcdFx0XHRsaW5rLnR5cGUgPSBMSU5LX1RZUEUuREVGQVVMVDtcblx0XHRcdH1cblx0XHRcdHN3aXRjaChsaW5rLnR5cGUpIHtcblx0XHRcdFx0Y2FzZSBMSU5LX1RZUEUuQVJST1c6XG5cdFx0XHRcdFx0bGluay5oZWFkT2Zmc2V0ID0gbGluay50YXJnZXQucmFkaXVzO1xuXHRcdFx0XHRcdGxpbmtPYmplY3QgPSBwYXRoLmFycm93KGxpbmspO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIExJTktfVFlQRS5BUkM6XG5cdFx0XHRcdFx0bGlua09iamVjdCA9IHBhdGguYXJjKGxpbmspO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIExJTktfVFlQRS5MSU5FOlxuXHRcdFx0XHRjYXNlIExJTktfVFlQRS5ERUZBVUxUOlxuXHRcdFx0XHRcdGxpbmtPYmplY3QgPSBwYXRoLmxpbmUobGluayk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0bGlua09iamVjdCA9IHBhdGgubGluZShsaW5rKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHRoYXQuX25vZGVJbmRleFRvTGlua0xpbmVbbGluay5zb3VyY2UuaW5kZXhdLnB1c2gobGlua09iamVjdCk7XG5cdFx0XHR0aGF0Ll9ub2RlSW5kZXhUb0xpbmtMaW5lW2xpbmsudGFyZ2V0LmluZGV4XS5wdXNoKGxpbmtPYmplY3QpO1xuXG5cdFx0XHR0aGF0Ll9zY2VuZS5hZGRDaGlsZChsaW5rT2JqZWN0KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX25vZGVzLmZvckVhY2goZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0dmFyIGNpcmNsZSA9IHBhdGguY2lyY2xlKG5vZGUpO1xuXHRcdFx0dGhhdC5fbm9kZUluZGV4VG9DaXJjbGVbbm9kZS5pbmRleF0gPSBjaXJjbGU7XG5cdFx0XHRpZiAodGhhdC5fbm9kZU92ZXIgfHwgdGhhdC5fZHJhZ2dhYmxlKSB7XG5cdFx0XHRcdGNpcmNsZS5vZmYoJ21vdXNlb3ZlcicpO1xuXHRcdFx0XHRjaXJjbGUub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRpZiAodGhhdC5fZXZlbnRzU3VzcGVuZGVkKCkpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0aWYgKHRoYXQuX25vZGVPdmVyKSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9ub2RlT3ZlcihjaXJjbGUsIGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhhdC5fY3VycmVudE1vdmVTdGF0ZSE9PSdkcmFnZ2luZycpIHtcblx0XHRcdFx0XHRcdHRoYXQuX2N1cnJlbnRPdmVyTm9kZSA9IGNpcmNsZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhhdC5fc2NlbmUudXBkYXRlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoYXQuX25vZGVPdXQgfHwgdGhhdC5fZHJhZ2dhYmxlKSB7XG5cdFx0XHRcdGNpcmNsZS5vZmYoJ21vdXNlb3V0Jyk7XG5cdFx0XHRcdGNpcmNsZS5vbignbW91c2VvdXQnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICh0aGF0Ll9jdXJyZW50TW92ZVN0YXRlIT09J2RyYWdnaW5nJykge1xuXHRcdFx0XHRcdFx0dGhhdC5fY3VycmVudE92ZXJOb2RlID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoYXQuX25vZGVPdXQpIHtcblx0XHRcdFx0XHRcdHRoYXQuX25vZGVPdXQoY2lyY2xlLCBlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhhdC5fc2NlbmUudXBkYXRlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoYXQuX25vZGVDbGljaykge1xuXHRcdFx0XHRjaXJjbGUub2ZmKCdjbGljaycpO1xuXHRcdFx0XHRjaXJjbGUub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdGlmICh0aGF0Ll9ldmVudHNTdXNwZW5kZWQoKSkgeyByZXR1cm47IH1cblx0XHRcdFx0XHR0aGF0Ll9ub2RlQ2xpY2soY2lyY2xlLGUpO1xuXHRcdFx0XHRcdHRoYXQuX3NjZW5lLnVwZGF0ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAodGhhdC5fZ3JvdXBpbmdNYW5hZ2VyKSB7XG5cdFx0XHRcdGNpcmNsZS5vZmYoJ2NsaWNrJyk7XG5cdFx0XHRcdGNpcmNsZS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQuX2V2ZW50c1N1c3BlbmRlZCgpKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmICh0aGF0Ll9ub2RlT3V0KSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll9ub2RlT3V0KGNpcmNsZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoYXQudW5ncm91cChjaXJjbGUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHRoYXQuX3NjZW5lLmFkZENoaWxkKGNpcmNsZSk7XG5cblx0XHRcdGlmIChub2RlLmxhYmVsKSB7XG5cdFx0XHRcdHRoYXQuYWRkTGFiZWwobm9kZSxub2RlLmxhYmVsKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLnNob3dBbGxMYWJlbHMoKSkge1xuXHRcdFx0dGhpcy5zaG93QWxsTGFiZWxzKHRydWUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xheW91dGVyLmxpbmtNYXAodGhpcy5fbm9kZUluZGV4VG9MaW5rTGluZSlcblx0XHRcdC5ub2RlTWFwKHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlKVxuXHRcdFx0LmxhYmVsTWFwKHRoaXMuX25vZGVJbmRleFRvTGFiZWwpO1xuXG5cblx0XHR0aGlzLl9hZGRQcmVBbmRQb3N0UmVuZGVyT2JqZWN0cygpO1xuXG5cdFx0Ly8gRHJhdyBhbnkgdW5ncm91cGVkIG5vZGUgYm91bmRpbmcgYm94ZXNcblx0XHR0aGlzLl9hZGRSZWdyb3VwSGFuZGxlcygpO1xuXG5cdFx0dGhpcy5fc2NlbmUuYWRkQ2hpbGQodGhpcy5fcG9zdHJlbmRlckdyb3VwKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIERlYnVnIHJvdXRpbmcgdG8gZHJhdyBhIGJvdW5kaW5nIGJveCBhcm91bmQgdGhlIG5vZGVzXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfZGVidWdEcmF3Qm91bmRpbmdCb3ggOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgYm91bmRpbmdCb3ggPSB0aGlzLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveCh0aGlzLl9ub2Rlcyk7XG5cdFx0aWYgKHRoaXMuX2JiUmVuZGVyKSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0aGlzLl9iYlJlbmRlcik7XG5cdFx0fVxuXHRcdHRoaXMuX2JiUmVuZGVyID0gcGF0aC5yZWN0KHtcblx0XHRcdHggOiBib3VuZGluZ0JveC54LFxuXHRcdFx0eSA6IGJvdW5kaW5nQm94LnksXG5cdFx0XHR3aWR0aCA6IGJvdW5kaW5nQm94LndpZHRoLFxuXHRcdFx0aGVpZ2h0IDogYm91bmRpbmdCb3guaGVpZ2h0LFxuXHRcdFx0c3Ryb2tlU3R5bGUgOiAnI2ZmMDAwMCcsXG5cdFx0XHRsaW5lV2lkdGggOiAyXG5cdFx0fSk7XG5cdFx0dGhpcy5fc2NlbmUuYWRkQ2hpbGQodGhpcy5fYmJSZW5kZXIpO1xuXHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBGaXQgdGhlIGdyYXBoIHRvIHRoZSBzY3JlZW5cblx0ICovXG5cdGZpdCA6IGZ1bmN0aW9uKHBhZGRpbmcpIHtcblxuXHRcdC8vIFJldHVybiBiYWNrIHRvIG9yaWdpblxuXHRcdHRoaXMuX3BhbigtdGhpcy5fc2NlbmUueCwtdGhpcy5fc2NlbmUueSk7XG5cblxuXG5cdFx0Ly8gV29ya2luZyB3aXRoIGJpZyBudW1iZXJzLCBpdCdzIGJldHRlciBpZiB3ZSBkbyB0aGlzIHR3aWNlLlxuXHRcdHZhciBib3VuZGluZ0JveDtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IDI7IGkrKykge1xuXHRcdFx0Ym91bmRpbmdCb3ggPSB0aGlzLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveCh0aGlzLl9ub2RlcyxwYWRkaW5nKTtcblx0XHRcdHZhciB4UmF0aW8gPSB0aGlzLl9zY2VuZS53aWR0aCAvIGJvdW5kaW5nQm94LndpZHRoO1xuXHRcdFx0dmFyIHlSYXRpbyA9IHRoaXMuX3NjZW5lLmhlaWdodCAvIGJvdW5kaW5nQm94LmhlaWdodDtcblx0XHRcdHRoaXMuX3pvb20oTWF0aC5taW4oeFJhdGlvLCB5UmF0aW8pLCAwLCAwKTtcblx0XHR9XG5cblx0XHR2YXIgbWlkU2NyZWVuWCA9IHRoaXMuX3NjZW5lLndpZHRoIC8gMjtcblx0XHR2YXIgbWlkU2NyZWVuWSA9IHRoaXMuX3NjZW5lLmhlaWdodCAvIDI7XG5cdFx0Ym91bmRpbmdCb3ggPSB0aGlzLl9sYXlvdXRlci5nZXRCb3VuZGluZ0JveCh0aGlzLl9ub2Rlcyk7XG5cdFx0dmFyIG1pZEJCWCA9IGJvdW5kaW5nQm94LnggKyBib3VuZGluZ0JveC53aWR0aCAvIDI7XG5cdFx0dmFyIG1pZEJCWSA9IGJvdW5kaW5nQm94LnkgKyBib3VuZGluZ0JveC5oZWlnaHQgLyAyO1xuXHRcdHRoaXMuX3BhbigtKG1pZEJCWC1taWRTY3JlZW5YKSwtKG1pZEJCWS1taWRTY3JlZW5ZKSk7XG5cblx0XHR0aGlzLl96b29tU2NhbGUgPSAxLjA7XG5cdFx0dGhpcy5fbGF5b3V0ZXIuX3pvb21TY2FsZSA9IDEuMDtcblx0XHQvLyBab29tIHRoZSByZW5kZXIgZ3JvdXBzXG5cdFx0Ly9pZiAodGhpcy5fcHJlcmVuZGVyR3JvdXApIHtcblx0XHQvL1x0dGhpcy5fcHJlcmVuZGVyR3JvdXAuc2NhbGVYID0gdGhpcy5fem9vbVNjYWxlO1xuXHRcdC8vXHR0aGlzLl9wcmVyZW5kZXJHcm91cC5zY2FsZVkgPSB0aGlzLl96b29tU2NhbGU7XG5cdFx0Ly99XG5cdFx0Ly9pZiAodGhpcy5fcG9zdHJlbmRlckdyb3VwKSB7XG5cdFx0Ly9cdHRoaXMuX3Bvc3RyZW5kZXJHcm91cC5zY2FsZVggPSB0aGlzLl96b29tU2NhbGU7XG5cdFx0Ly9cdHRoaXMuX3Bvc3RyZW5kZXJHcm91cC5zY2FsZVkgPSB0aGlzLl96b29tU2NhbGU7XG5cdFx0Ly99XG5cdFx0dGhpcy51cGRhdGUoKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTdXNwZW5kIG1vdXNlIGV2ZW50cyBhbmQgem9vbWluZ1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3N1c3BlbmRFdmVudHMgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLl9sYXlvdXRlci5fZXZlbnRzU3VzcGVuZGVkID0gdHJ1ZTtcblx0fSxcblxuXHQvKipcblx0ICogcmVzdW1lIG1vdXNlIGV2ZW50cyBhbmQgem9vbWluZ1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X3Jlc3VtZUV2ZW50cyA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX2xheW91dGVyLl9ldmVudHNTdXNwZW5kZWQgPSBmYWxzZTtcblx0fSxcblxuXHQvKipcblx0ICogUXVlcnkgZXZlbnQgc3VzcGVuc2lvbiBzdGF0dXNcblx0ICogQHJldHVybnMgYm9vbGVhblxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2V2ZW50c1N1c3BlbmRlZCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRlci5fZXZlbnRzU3VzcGVuZGVkO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZW1vdmVzIGFsbCByZW5kZXIgb2JqZWN0cyBhc3NvY2lhdGVkIHdpdGggYSBncmFwaC5cblx0ICovXG5cdGNsZWFyIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHJlbW92ZVJlbmRlck9iamVjdHMgPSBmdW5jdGlvbihpbmRleFRvT2JqZWN0KSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gaW5kZXhUb09iamVjdCkge1xuXHRcdFx0XHRpZiAoaW5kZXhUb09iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdFx0dmFyIG9iaiA9IGluZGV4VG9PYmplY3Rba2V5XTtcblx0XHRcdFx0XHRpZiAoJC5pc0FycmF5KG9iaikpIHtcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKG9ialtpXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRlbGV0ZSBpbmRleFRvT2JqZWN0W2tleV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJlbW92ZVJlbmRlck9iamVjdHMuY2FsbCh0aGlzLHRoaXMuX25vZGVJbmRleFRvQ2lyY2xlKTtcblx0XHRyZW1vdmVSZW5kZXJPYmplY3RzLmNhbGwodGhpcyx0aGlzLl9ub2RlSW5kZXhUb0xpbmtMaW5lKTtcblx0XHRyZW1vdmVSZW5kZXJPYmplY3RzLmNhbGwodGhpcyx0aGlzLl9ub2RlSW5kZXhUb0xhYmVsKTtcblx0XHRpZiAodGhpcy5fcHJlcmVuZGVyR3JvdXApIHtcblx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKHRoaXMuX3ByZXJlbmRlckdyb3VwKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2hhbmRsZUdyb3VwKSB7XG5cdFx0XHR0aGlzLl9zY2VuZS5yZW1vdmVDaGlsZCh0aGlzLl9oYW5kbGVHcm91cCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9wb3N0cmVuZGVyR3JvdXApIHtcblx0XHRcdHRoaXMuX3NjZW5lLnJlbW92ZUNoaWxkKHRoaXMuX3Bvc3RyZW5kZXJHcm91cCk7XG5cdFx0fVxuXHRcdHRoaXMuX3NjZW5lLnVwZGF0ZSgpO1xuXG5cdFx0aWYgKHRoaXMuX2dyb3VwaW5nTWFuYWdlcikge1xuXHRcdFx0dGhpcy5fZ3JvdXBpbmdNYW5hZ2VyLmNsZWFyKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn0pO1xuXG5cbmV4cG9ydHMuTElOS19UWVBFID0gcmVxdWlyZSgnLi9saW5rVHlwZScpO1xuZXhwb3J0cy5Hcm91cGluZ01hbmFnZXIgPSByZXF1aXJlKCcuL2dyb3VwaW5nTWFuYWdlcicpO1xuZXhwb3J0cy5MYXlvdXQgPSByZXF1aXJlKCcuL2xheW91dCcpO1xuZXhwb3J0cy5Db2x1bW5MYXlvdXQgPSByZXF1aXJlKCcuL2NvbHVtbkxheW91dCcpO1xuZXhwb3J0cy5SYWRpYWxMYXlvdXQgPSByZXF1aXJlKCcuL3JhZGlhbExheW91dCcpO1xuZXhwb3J0cy5FeHRlbmQgPSBfLmV4dGVuZDtcbmV4cG9ydHMuR3JhcGggPSBHcmFwaDsiLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIExheW91dCA9IHJlcXVpcmUoJy4vbGF5b3V0Jyk7XG4vKipcbiAqXG4gKiBAcGFyYW0gZm9jdXMgLSB0aGUgbm9kZSBhdCB0aGUgY2VudGVyIG9mIHRoZSByYWRpYWwgbGF5b3V0XG4gKiBAcGFyYW0gZGlzdGFuY2UgLSB0aGUgZGlzdGFuY2Ugb2Ygb3RoZXIgbm9kZXMgZnJvbSB0aGUgZm9jdXNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBSYWRpYWxMYXlvdXQoZm9jdXMsZGlzdGFuY2UpIHtcblx0dGhpcy5fZm9jdXMgPSBmb2N1cztcblx0dGhpcy5fZGlzdGFuY2UgPSBkaXN0YW5jZTtcblxuXHRMYXlvdXQuYXBwbHkodGhpcyk7XG59XG5cblxuUmFkaWFsTGF5b3V0LnByb3RvdHlwZSA9IF8uZXh0ZW5kKFJhZGlhbExheW91dC5wcm90b3R5cGUsIExheW91dC5wcm90b3R5cGUsIHtcblx0LyoqXG5cdCAqIEdldHMvc2V0cyB0aGUgZGlzdGFuY2UgcGFyYW1ldGVyXG5cdCAqIEBwYXJhbSBkaXN0YW5jZSAtIHRoZSBkaXN0YW5jZSBvZiBsaW5rcyBmcm9tIHRoZSBmb2N1cyBub2RlIHRvIG90aGVyIG5vZGVzIGluIHBpeGVsc1xuXHQgKiBAcmV0dXJucyB7UmFkaWFsTGF5b3V0fSBpZiBkaXN0YW5jZSBwYXJhbSBpcyBkZWZpbmVkLCB7UmFkaWFsTGF5b3V0Ll9kaXN0YW5jZX0gb3RoZXJ3aXNlXG5cdCAqL1xuXHRkaXN0YW5jZTogZnVuY3Rpb24gKGRpc3RhbmNlKSB7XG5cdFx0aWYgKGRpc3RhbmNlKSB7XG5cdFx0XHR0aGlzLl9kaXN0YW5jZSA9IGRpc3RhbmNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZGlzdGFuY2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXRzL3NldHMgdGhlIGZvY3VzIG5vZGUgdGhhdCBpcyBhdCB0aGUgY2VudGVyIG9mIHRoZSBsYXlvdXRcblx0ICogQHBhcmFtIGZvY3VzIC0gdGhlIG5vZGUgdGhhdCBpcyBhdCB0aGUgY2VudGVyIG9mIHRoZSBsYXlvdXQuICAgT3RoZXIgbm9kZXMgYXJlIGNlbnRlcmVkIGFyb3VuZCB0aGlzLlxuXHQgKiBAcmV0dXJucyB7UmFkaWFsTGF5b3V0fSBpZiBmb2N1cyBwYXJhbSBpcyBkZWZpbmVkLCB7UmFkaWFsTGF5b3V0Ll9mb2N1c30gb3RoZXJ3aXNlXG5cdCAqL1xuXHRmb2N1czogZnVuY3Rpb24gKGZvY3VzKSB7XG5cdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHR0aGlzLl9mb2N1cyA9IGZvY3VzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZm9jdXM7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGxhYmVsIHBvc2l0aW9uIGZvciBhIG5vZGVcblx0ICogQHBhcmFtIG5vZGVYIC0gdGhlIHggcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIG5vZGVZIC0gdGhlIHkgcG9zaXRpb24gb2YgdGhlIG5vZGVcblx0ICogQHBhcmFtIHJhZGl1cyAtIHRoZSByYWRpdXMgb2YgdGhlIG5vZGVcblx0ICogQHJldHVybnMge3t4OiB4IHBvc2l0aW9uIG9mIHRoZSBsYWJlbCwgeTogeSBwb3NpdGlvbiBvZiB0aGUgbGFiZWwsIGFsaWduOiBIVE1MIGNhbnZhcyB0ZXh0IGFsaWdubWVudCBwcm9wZXJ0eSBmb3IgbGFiZWx9fVxuXHQgKi9cblx0bGF5b3V0TGFiZWw6IGZ1bmN0aW9uIChub2RlWCwgbm9kZVksIHJhZGl1cykge1xuXHRcdHZhciB4LCB5LCBhbGlnbjtcblxuXHRcdC8vIFJpZ2h0IG9mIGNlbnRlclxuXHRcdGlmIChub2RlWCA+IHRoaXMuX2ZvY3VzKSB7XG5cdFx0XHR4ID0gbm9kZVggKyAocmFkaXVzICsgMTApO1xuXHRcdFx0YWxpZ24gPSAnc3RhcnQnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR4ID0gbm9kZVggLSAocmFkaXVzICsgMTApO1xuXHRcdFx0YWxpZ24gPSAnZW5kJztcblx0XHR9XG5cblx0XHRpZiAobm9kZVkgPiB0aGlzLl9mb2N1cykge1xuXHRcdFx0eSA9IG5vZGVZICsgKHJhZGl1cyArIDEwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0eSA9IG5vZGVZIC0gKHJhZGl1cyArIDEwKTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHg6IHgsXG5cdFx0XHR5OiB5LFxuXHRcdFx0YWxpZ246IGFsaWduXG5cdFx0fTtcblx0fSxcblxuXHQvKipcblx0ICogUGVyZm9ybSBhIHJhZGlhbCBsYXlvdXRcblx0ICogQHBhcmFtIHcgLSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhcyBiZWluZyByZW5kZXJlZCB0b1xuXHQgKiBAcGFyYW0gaCAtIHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyBiZWluZyByZW5kZXJlZCB0b1xuXHQgKi9cblx0bGF5b3V0OiBmdW5jdGlvbiAodywgaCkge1xuXHRcdHZhciBub2RlcyA9IHRoaXMubm9kZXMoKTtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0dmFyIGFuZ2xlRGVsdGEgPSBNYXRoLlBJICogMiAvIChub2Rlcy5sZW5ndGggLSAxKTtcblx0XHR2YXIgYW5nbGUgPSAwLjA7XG5cdFx0bm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuXHRcdFx0aWYgKG5vZGUuaW5kZXggPT09IHRoYXQuX2ZvY3VzLmluZGV4KSB7XG5cdFx0XHRcdHRoYXQuX3NldE5vZGVQb3NpdGlvbihub2RlLCBub2RlLngsIG5vZGUueSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBuZXdYID0gdGhhdC5fZm9jdXMueCArIChNYXRoLmNvcyhhbmdsZSkgKiB0aGF0Ll9kaXN0YW5jZSk7XG5cdFx0XHR2YXIgbmV3WSA9IHRoYXQuX2ZvY3VzLnkgKyAoTWF0aC5zaW4oYW5nbGUpICogdGhhdC5fZGlzdGFuY2UpO1xuXHRcdFx0dGhhdC5fc2V0Tm9kZVBvc2l0aW9uKG5vZGUsIG5ld1gsIG5ld1kpO1xuXHRcdFx0YW5nbGUgKz0gYW5nbGVEZWx0YTtcblx0XHR9KTtcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUmFkaWFsTGF5b3V0O1xuIiwiXG52YXIgVXRpbCA9IHtcblxuICBleHRlbmQ6IGZ1bmN0aW9uKGRlc3QsIHNvdXJjZXMpIHtcbiAgICB2YXIga2V5LCBpLCBzb3VyY2U7XG4gICAgZm9yIChpPTE7IGk8YXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgaWYgKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgZGVzdFtrZXldID0gc291cmNlW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc3Q7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXRpbDsiXX0=
(5)
});
