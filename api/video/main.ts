// Crawlee - web scraping library (https://crawlee.dev)
import { CheerioCrawler } from '@crawlee/cheerio';
// Apify SDK - toolkit for Apify Actors (https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';

import { router } from './routes.js';

interface Input {
    startUrls: { url: string }[];
    maxRequestsPerCrawl?: number;
    maxPages?: number;
    useProxy?: boolean;
}

await Actor.init();

const input = (await Actor.getInput<Input>()) ?? ({} as Input);
const startUrls = (input.startUrls ?? []).map((s) => ({ url: s.url, userData: { kind: 'list' } }));
const maxRequestsPerCrawl = input.maxRequestsPerCrawl ?? 50;

const proxyConfiguration =
    input.useProxy === false ? undefined : await Actor.createProxyConfiguration();

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    maxConcurrency: 5,
    requestHandlerTimeoutSecs: 60,
    requestHandler: router,
});

await crawler.run(startUrls);

await Actor.exit();
