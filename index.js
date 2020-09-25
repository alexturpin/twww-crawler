import Crawler from 'crawler';
import sanitize from 'sanitize-filename';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const BASE_URI = 'http://thewestwingweekly.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:81.0) Gecko/20100101 Firefox/81.0'; // Real UA is needed to prevent the website from returning 400s
const START_AT = 2; // Skip "Coming Soon" and "Cold Open"
const STOP_AT = Infinity; // For debugging purposes
const SANITIZE_PATH = path => sanitize(path).trim(); // For my poor Windows machine that can't handle these
const AUDIO_PATH = episodeTitle => `downloads/audio/${SANITIZE_PATH(episodeTitle)}.mp3`;
const TRANSCRIPT_PATH = episodeTitle => `downloads/transcript/${SANITIZE_PATH(episodeTitle)}.pdf`;

const fileDownloader = new Crawler({
	userAgent: USER_AGENT,
	encoding: null,
	jQuery: false,
	callback: (error, res, done) => {
		if (error) {
			throw error;
		}

		if (existsSync(res.options.downloadPath)) {
			return done();
		}

		createWriteStream(res.options.downloadPath)
			.write(res.body, done);
	}
});

const episodeCrawler = new Crawler({
	userAgent: USER_AGENT,
	callback: (error, res, done) => {
		if (error) {
			throw error;
		}

		const $ = res.$;

		const audioUri = $('a[href$=".mp3"]').prop('href');
		const transcriptUri = BASE_URI + $('a[href$=".pdf"]').prop('href');

		fileDownloader.queue({
			uri: audioUri,
			downloadPath: AUDIO_PATH(res.options.episodeTitle)
		});

		fileDownloader.queue({
			uri: transcriptUri,
			downloadPath: TRANSCRIPT_PATH(res.options.episodeTitle)
		});

		done();
	}
});

const episodeListCrawler = new Crawler({
	userAgent: USER_AGENT,
	callback: (error, res, done) => {
		if (error) {
			throw error;
		}

		const $ = res.$;
		
		$('.archive-item-link')
			.filter(idx => idx >= START_AT && idx <= STOP_AT)
			.each((idx, link) => {
				const episodeTitle= $(link).text();
				const episodeUri = BASE_URI + $(link).prop('href');
				
				episodeCrawler.queue({
					uri: episodeUri,
					episodeTitle
				});
			});
		
		done();
	}
});


// Create needed download directories
mkdirSync(dirname(AUDIO_PATH('')), { recursive: true });
mkdirSync(dirname(TRANSCRIPT_PATH('')), { recursive: true });

episodeListCrawler.queue(`${BASE_URI}/index`);
