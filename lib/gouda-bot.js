const Yelp = require('yelp');
const request = require('request');

const yelp = new Yelp({
	consumer_key: process.env.consumer_key ,
	consumer_secret: process.env.consumer_secret,
	token: process.env.yelp_token,
	token_secret: process.env.yelp_token_secret
});

const errorMessages = [
	"https://media.giphy.com/media/oQ6P5nknXM40w/giphy.gif",
	"https://media.giphy.com/media/gpufDFw0sPBYY/giphy.gif",
	"https://media.giphy.com/media/11NBUrJDuMd5As/giphy.gif",
	"https://media.giphy.com/media/JwVWLRnZkh2M0/giphy.gif",
	"https://media.giphy.com/media/9ohlKnRDAmotG/giphy.gif"
];

// explicit text message from the user
exports.receivedMessage = (messagingEvent, userStates) => {
	var recipientId = messagingEvent.sender.id;
	console.log('message', JSON.stringify(messagingEvent));

	if (messagingEvent.message.hasOwnProperty('quick_reply') && messagingEvent.message.quick_reply.payload === "RIGHT_FORMAT") {
		sendResponse({
                        recipient: {id: recipientId},
                        message: {
                                text: "Legend: \n  [...] ignored\n  (...) optional\n  <...> Type expected\n  | either one\n\nFormat: \n  [Show me, find me] [the] (closest | best) (<cuisine adjective>) RESTAURANTS (IN <city> | WITHIN <number> km)\n\ne.g. \"best greek restaurants within 3 km\"\n\nI hope that makes sense :)"
                        }
                })
        } else if (messagingEvent.message.hasOwnProperty('quick_reply') && messagingEvent.message.quick_reply.payload === "MORE_SUGGESTIONS") {
		var yelpObjCoord = userStates[recipientId];

		if (!yelpObjCoord) return;
		yelpObjCoord.offset += 5;

		sendResponse({
			recipient: {id: recipientId},
			sender_action: "typing_on"
		});
		callYelpAPI(yelpObjCoord, recipientId);
	} else if (messagingEvent.message.hasOwnProperty('attachments') && messagingEvent.message.attachments[0].type === "location") {
		var yelpObjCoord = userStates[recipientId];
		yelpObjCoord.coords = messagingEvent.message.attachments[0].payload.coordinates;

		// call yelp api
		console.log(yelpObjCoord);

		sendResponse({
			recipient: {id: recipientId},
			sender_action: "typing_on"
		});
		callYelpAPI(yelpObjCoord, recipientId);
	} else if (messagingEvent.message.text) {
		sendResponse({
			recipient: {id: recipientId},
			sender_action: "typing_on"
		});

		if (messagingEvent.message.text.split(' ').length < 3) return sendErrorMessage(recipientId, messagingEvent.message.text.toLowerCase());

		// TODO: call wit.ai with query string, and wait for understanding results
		request({
			url: 'https://api.wit.ai/message',
			qs: {
				q: messagingEvent.message.text
			},
			headers: {
				Authorization: `Bearer ${process.env.witai_token}`
			},
			json: true
		}, (err, response, body) => {
			console.log('bodyyy', body);
			if (err || Object.keys(body.entities).length === 0) return sendErrorMessage(recipientId, messagingEvent.message.text.toLowerCase());
			
			var yelpObj = {
				sorting: body.entities.sort ? body.entities.sort[0].value :  'match',
				category: body.entities.cuisine ? body.entities.cuisine[0].value : 'restaurant',
				in: body.entities.location ? body.entities.location[0].value : null,
				within: body.entities.number ? body.entities.number[0].value : null,
				coords: null,
				offset: 0
			};

			if (!yelpObj.in && !yelpObj.within) return sendErrorMessage(recipientId, messagingEvent.message.text.toLowerCase());
			if (!yelpObj.category.includes('restaurant')) yelpObj.category += ' restaurant';

			userStates[recipientId] = yelpObj;
			console.log(userStates)
			if (yelpObj.within) {
				// ask for coords
				sendResponse({
					recipient: {id: recipientId},
					message: {
						"text":"Please share your location:",
	    					"quick_replies":[
	      					    {
	        					"content_type":"location",
	      					    }
	    					]
					}
				});
			} else {
				sendResponse({
					recipient: {id: recipientId},
					sender_action: "typing_on"
				});

				callYelpAPI(yelpObj, recipientId);
				// call api with upgraded yelpObj
			}
		});
	} else {
		sendResponse({
			recipient: {id: recipientId},
			sender_action: "typing_on"
		});

		sendErrorMessage(recipientId, messagingEvent.message.text.toLowerCase());
	}
};


// get started, button click, and so on
exports.receivedPostback = (messagingEvent) => {
	var recipientId = messagingEvent.sender.id;

	console.log('postback', JSON.stringify(messagingEvent));

	if (messagingEvent.postback.payload === "NEW_THREAD_STARTED") {
		sendResponse({
			recipient: {id: recipientId},
			sender_action: "typing_on"
		});

		setTimeout(() => {
		    sendResponse({
			recipient: {id: recipientId},
			message: {
				text: "Hey, I'm GoudaBot! I can easily help you find good restaurants with specific filters. Just write me what are your expectations, and I'll try to find good results. Make sure to respect the right formulation format, I'm new here!"
			}
		    }, {
			recipient: {id: recipientId},
			message: {
				text: "For example, you can ask me \"Show me the closest restaurant in Oshawa\", or \"italian restaurant within 2 km\". The menu below contains the format required, if you happen to forget it. Bon appétit! :D",
				quick_replies: [
					{
						content_type: "text",
						title: "Format",
						payload: "RIGHT_FORMAT"
					}
				]
			}
		    })
		}, 1500);
	} else if (messagingEvent.postback.payload === "RIGHT_FORMAT") {
		sendResponse({
			recipient: {id: recipientId},
			message: {
				text: "Legend: \n  [...] ignored\n  (...) optional\n  <...> Type expected\n  | either one\n\nFormat: \n  [Show me, find me] [the] (closest | best) (<cuisine adjective>) RESTAURANTS (IN <city> | WITHIN <number> km)\n\ne.g. \"best greek restaurants within 3 km\"\n\nI hope that makes sense :)"
			}
		})
	} else if (messagingEvent.postback.payload === "NEED_HELP") {
		sendResponse({
			recipient: {id: recipientId},
			message: {
				text: "Hello again! If you need help to find good restaurants with custom filters, I can help you. Just write me what are your expectations, and I'll try to find good results. Make sure to respect the right format, otherwise I may not understand you :/"
			}
		}, {
			recipient: {id: recipientId},
			message: {
				text: "For example, you can ask me \"Show me restaurants in Montréal\", or \"Chinese restaurants within 2 km\". The menu below contains the format required, if you happen to forget it."
			}
		});
	}
};


function sendResponse(response, secondResponse) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.page_access_token },
    method: 'POST',
    json: response
  }, (err) => {
    console.log (err, arguments[1]);
    if (!err && secondResponse) {
      console.log('second one incoming')
      request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: process.env.page_access_token },
        method: 'POST',
        json: secondResponse
      })
    }
  });
}

function sendErrorMessage(recipientId, message) {
	if (message === "NO_RESULT") {
		sendResponse({
			recipient: {id: recipientId},
			message: {
				text: "No results found :/"
			}
		});
	} else if (message.includes('cena')) {
		getWhatGif('cena', (gifData) => {
		sendResponse({
			recipient: {id: recipientId},
									message: {
													attachment: {
																	type: "image",
																	payload: {
																					url: gifData.data ? gifData.data.image_original_url : "https://media.giphy.com/media/12XNRtl6kZxQVq/giphy.gif" 
																	}
													}
									}
		}, {
			recipient: {id: recipientId},
			message: {
				text: "The text you entered is incorrect - please ensure you follow the right format"
			}
		})
		});
	} else {
		getWhatGif(null, (gifData) => {
		sendResponse({
			recipient: {id: recipientId},
			message: {
				attachment: {
					type: "image",
					payload: {
						url: gifData.data ? gifData.data.image_original_url : errorMessages[Math.floor(Math.random() * errorMessages.length)]
					}
				}
			}
		}, {
															recipient: {id: recipientId},
															message: {
																			text: "The text you entered is incorrect - please ensure you follow the right format"
															}
											})
		});
	}
}

function callYelpAPI(obj, id) {

	var sorting;
	var yelpSearchObj;

	if (obj.sorting == 'best') {
		sorting = 2;
	} else if (obj.sorting == 'closest') {
		sorting = 1;
	} else {
		sorting = 0;
	}

	if (obj.in == null) {
		yelpSearchObj = {
			term: obj.category,
			ll: `${obj.coords.lat}, ${obj.coords.long}`,
			radius_filter: obj.within * 1000,
			sort: sorting,
			limit: 5,
			offset: obj.offset
		};
	} else {
		yelpSearchObj = {
			term: obj.category,
			location: obj.in,
			sort: sorting,
			limit: 5,
			offset: obj.offset
		};
	}

	console.log(yelpSearchObj);

	yelp.search(yelpSearchObj).then(function (data) {
		if (data.businesses.length === 0) {
			sendResponse({
				recipient: {id},
				message: {
					text: "No results found :/"
				}
			});
		} else {
			cleanupYelpObj(data, id);
		}
	}).catch(function (err) {
		sendErrorMessage(id, 'NO_RESULT');
		console.log(err);
	});
}

function cleanupYelpObj(obj, id) {
	var cleanedObj = [];

	obj.businesses.forEach((item) => {
		cleanedObj.push({
			title: item.name,
			subtitle: item.snippet_text,
			item_url: item.url,
			image_url: item.image_url,
			phone: item.display_phone
		});
	});

	// Call method with cleaned data
	console.log(cleanedObj);
	generateResultTemplates(cleanedObj, id);

}

function generateResultTemplates(data, id) {
	var templates = {
		recipient: {id},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "generic",
					elements: data.map((elem) => {
						return {
							title: elem.title,
							item_url: elem.item_url,
							image_url: elem.image_url,
							subtitle: elem.subtitle,
							buttons: [{
								type: "web_url",
								url: elem.item_url,
								title: "View Restaurant",
								webview_height_ratio: "tall"
							}, {
								type: "phone_number",
								title: "Call Restaurant",
								payload: elem.phone
							}]
						};
					})
				}
			}
		}
	};

	sendResponse(templates, {
		recipient: {id},
		message: {
			text: "Want more suggestions?",
			quick_replies: [{
				content_type: "text",
				title: "More suggestions!",
				payload: "MORE_SUGGESTIONS"
			}]
		}
	});
}

function getWhatGif(tag, callback) {
	if (!tag) tag = 'what';
	console.log(process.env.giphy_token);	
	request({
    		uri: 'https://api.giphy.com/v1/gifs/random',
		qs: { 
			api_key: process.env.giphy_token,
			fmt: 'json',
			tag 
		},
		method: 'GET',
		json: true,
		jar: true
	}, (err, resp, body) => {
    		callback(body);
	})
}
