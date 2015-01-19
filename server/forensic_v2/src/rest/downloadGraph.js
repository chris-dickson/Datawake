define(['../util/util', '../util/guid', './testGraphResponse', '../config/forensic_config', '../util/events'], function(util,guid,TEST_RESPONSE,ForensicConfig,Events) {
	return {

		/**
		 * Ask the DataWake server for the info on the specified trail.
		 * @param trail
		 * @returns {*}
		 */
		post : function(uri) {
			var requestData = {};
			requestData.uri = uri;
			return $.ajax({
				type: 'POST',
				url: '/datawake/forensic/graphservice/download',
				data: JSON.stringify(requestData),
				contentType: 'application/json',
				dataType: 'json'
			});
		}
	};
});