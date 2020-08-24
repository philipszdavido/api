
const express = require('express');
const request = require('supertest');
const https = require('https');
const _ = require('lodash');
const logger = require('../../../src/utils/logging');
const expressLoader = require('../../../src/loaders/express');

jest.mock('sns-validator');
jest.mock('../../../src/config');
jest.mock('../../../src/utils/logging');
jest.mock('../../../src/cache', () => jest.fn());


const basicMsg = JSON.stringify({
  MessageId: 'da8827d4-ffc2-5efb-82c1-70f929b2081d',
  ResponseMetadata: {
    RequestId: '826314a1-e99f-5fe7-b845-438c3fef9901',
    HTTPStatusCode: 200,
    HTTPHeaders: {
      'x-amzn-requestid': '826314a1-e99f-5fe7-b845-438c3fef9901',
      'content-type': 'text/xml',
      'content-length': '294',
      date: 'Thu, 07 May 2020 09:26:08 GMT',
    },
    RetryAttempts: 0,
  },
});

describe('tests for experiment route', () => {
  afterEach(() => {
    logger.log.mockClear();
    logger.error.mockClear();
  });
  it('Can handle notifications', async () => {
    const { app } = await expressLoader(express());
    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'Notification';
    validMsg = JSON.stringify(validMsg);

    const mockHandleResponse = jest.fn(() => { });
    jest.mock('../../../src/api/route-services/work-response',
      () => jest.fn().mockImplementation(() => ({ handleResponse: mockHandleResponse })));

    await request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200);
    expect(logger.error).toHaveBeenCalledTimes(0);
    expect(mockHandleResponse).toHaveBeenCalledTimes(1);
  });
  it('Validating the response throws an error', async () => {
    const { app } = await expressLoader(express());
    const invalidMsg = _.cloneDeep(basicMsg);
    https.get = jest.fn();

    await request(app)
      .post('/v1/workResults')
      .send(invalidMsg)
      .set('Content-type', 'text/plain')
      .expect(200);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(https.get).toHaveBeenCalledTimes(0);
  });

  it('Can handle message subscribtion', async () => {
    const { app } = await expressLoader(express());
    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'SubscriptionConfirmation';
    validMsg = JSON.stringify(validMsg);
    https.get = jest.fn();

    await request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200);
    expect(logger.error).toHaveBeenCalledTimes(0);
    expect(https.get).toHaveBeenCalledTimes(1);
  });

  it('Can handle message unsubscribtion', async () => {
    const { app } = await expressLoader(express());
    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'UnsubscribeConfirmation';
    validMsg = JSON.stringify(validMsg);
    https.get = jest.fn();

    await request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200);
    expect(logger.error).toHaveBeenCalledTimes(0);
    expect(https.get).toHaveBeenCalledTimes(1);
  });

  it('Get malformatted work results returns an error', async () => {
    const { app } = await expressLoader(express());

    const brokenMsg = JSON.stringify();

    await request(app)
      .post('/v1/workResults')
      .send(brokenMsg)
      .set('Content-type', 'text/plain')
      .expect(500);
  });
  it('Returns an error when message in sns is malformed', async () => {
    const { app } = await expressLoader(express());

    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'NotificationMalformed';
    validMsg = JSON.stringify(validMsg);

    const mockHandleResponse = jest.fn();
    jest.mock('../../../src/api/route-services/work-response',
      () => jest.fn().mockImplementation(() => ({ handleResponse: mockHandleResponse })));

    await request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(mockHandleResponse).toHaveBeenCalledTimes(0);
  });
});
