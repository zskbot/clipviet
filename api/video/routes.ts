import { createCheerioRouter } from '@crawlee/cheerio';
import { Actor } from 'apify';

export const router = createCheerioRouter();

// Cấu hình theo từng site: mẫu link video và mẫu phân trang.
// Các site chưa có cấu hình sẽ dùng mẫu chung bên dưới.
interface SiteConfig {
    videoPattern: RegExp;
    paginationGlobs: string[];
}

const SITE_CONFIGS: Record<string, SiteConfig> = {
    'hsex.men': {
        videoPattern: /video-\d+\.htm/i,
        paginationGlobs: ['**/list-*.htm*', '**/*?sort=*'],
    },
    'sexonline.blog': {
        videoPattern: /^https?:\/\/sexonline\.blog\/[^/?#]+\/$/i,
        paginationGlobs: ['**/page/*'],
    },
    'sexvn.co': {
        videoPattern: /^https?:\/\/sexvn\.co\/[^/?#]+$/i,
        paginationGlobs: ['**/page/*', '**/*?page=*'],
    },
    'viet69.be': {
        videoPattern: /viet69\.be\/(bai-viet\/[^/?#]+|[^/?#]+)\/$/i,
        paginationGlobs: ['**/page/*'],
    },
    'javhay.onl': {
        videoPattern: /^https?:\/\/javhay\.onl\/[^/?#]+\/$/i,
        paginationGlobs: ['**/page/*'],
    },
};

// Mẫu chung cho site chưa có cấu hình
const GENERIC_VIDEO_PATTERN = /(\/video[-/]|\/watch[-/]|\/clip[-/]|\/phim[-/]|\/bai-viet\/|video-\d+\.htm)/i;
const GENERIC_PAGINATION_GLOBS = ['**/list-*.htm*', '**/*?page=*', '**/*?p=*', '**/page/*', '**/category/**', '**/tag/**'];

function configFor(url: string): { videoPattern: RegExp; paginationGlobs: string[] } {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const match = Object.keys(SITE_CONFIGS).find((d) => host === d || host.endsWith(`.${d}`));
    return match ? SITE_CONFIGS[match] : { videoPattern: GENERIC_VIDEO_PATTERN, paginationGlobs: GENERIC_PAGINATION_GLOBS };
}

router.addDefaultHandler(async ({ request, $, enqueueLinks, log }) => {
    const pageUrl = request.loadedUrl ?? request.url;
    const title = $('title').text().trim();
    const onListPage = request.userData?.kind !== 'video';
    const cfg = configFor(pageUrl);

    // 1. Thu thập các link trỏ tới trang video
    const videoLinks: string[] = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
            const abs = new URL(href, pageUrl).toString();
            if (cfg.videoPattern.test(abs)) videoLinks.push(abs);
        } catch {
            // bỏ qua href không hợp lệ
        }
    });
    const uniqueVideos = [...new Set(videoLinks)];

    // 2. Ghi URL video vào dataset
    for (const url of uniqueVideos) {
        await Actor.pushData({ sourcePage: pageUrl, videoUrl: url, pageTitle: title });
    }
    log.info(`Found ${uniqueVideos.length} video links on ${pageUrl}`);

    // 3. Đi theo phân trang (chỉ với trang danh sách)
    if (onListPage) {
        await enqueueLinks({
            globs: cfg.paginationGlobs,
            userData: { kind: 'list' },
            label: 'LIST',
        });
    }
});
