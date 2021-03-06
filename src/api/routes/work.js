/* eslint-disable no-console */
const https = require('https');

const MessageValidator = require('sns-validator');
const WorkResponseService = require('../route-services/work-response');
const logger = require('../../utils/logging');
const config = require('../../config');

const validator = new MessageValidator();

module.exports = {
  'work#response': async (req, res) => {
    let msg;

    logger.log('we got response back to parse...', req.body.length);

    // First let's try parsing the body. It should be JSON.
    try {
      msg = JSON.parse(req.body);
    } catch (error) {
      logger.trace('Parsing error: ', error);
      res.status(500).send('nok');
      return;
    }

    logger.log('message parsed', msg);

    // Asynchronously validate and process the message.
    validator.validate(msg, (err, message) => {
      if (config.clusterEnv !== 'development') {
        if (err) {
          logger.error(
            'Error validating the SNS response: ', err,
          );
          return;
        }

        // Handle subscripton and unsubscription automatically.
        if (message.Type === 'SubscriptionConfirmation'
          || message.Type === 'UnsubscribeConfirmation') {
          https.get(message.SubscribeURL);
        }
      }

      if (config.clusterEnv === 'development' && err) {
        // eslint-disable-next-line no-param-reassign
        message = msg;
      }

      // Notifications are passed on to the service for processing.
      if (message.Type === 'Notification') {
        logger.log('notification type message');

        try {
          const io = req.app.get('io');
          const workResult = JSON.parse(message.Message);
          logger.log('workresult parsed: ', workResult);

          const responseService = new WorkResponseService(io, workResult);
          responseService.handleResponse();
        } catch (e) {
          logger.error(
            'Error processing the work response message: ', e,
          );
        }
      }
    });

    // SNS is really dumb, so we can just send back a generic response.
    // It doesn't really care what we do afterwards.
    res.status(200).send('ok');
  },
};
