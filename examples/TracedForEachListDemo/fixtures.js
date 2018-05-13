import { PAGE_REF } from "./src/domain/index"
import { PAGE_INIT } from "./src/properties"

// NOTE: taken from https://s.bootsnipp.com/semanticui/snippets/featured/semantic-ui-cards

const BLACK_BIRD_DETAIL_ROUTE = 'watchProjector';
const TECHX_CARD_DETAIL_ROUTE = 'ladyGlasses';
const TYPOGRAPHICS_CARD_DETAIL_ROUTE = 'ali';

const BLACBIRD_CARD_INFO = {
  name: 'Blackbird Design Studio',
  category: 'aspirational',
  filter: 'Normal Filter',
  description: 'typographics',
  likes: '33',
  comments: '2',
  available: 'Available now!',
  concept: 'We established Blackbird Design Studio in 2013, bringing together 18 years of shared project experiences in the Midwest.',
  src: 'https://scontent.cdninstagram.com/vp/f8cb07b9e7d4620c1b407821af06dbc1/5B5EAE24/t51.2885-15/s640x640/sh0.08/e35/14134715_333197110352701_149519635_n.jpg',
  link: BLACK_BIRD_DETAIL_ROUTE
};
const TECHX_CARD_INFO = {
  name: 'TechX studio',
  category: 'aspirational',
  filter: 'Normal Filter',
  description: 'typographics',
  likes: '14',
  comments: '5',
  available: 'Register first!',
  concept: 'A petite design studio, specializing in brand identities, web and print. Perfect for your small business or special event.',
  src: 'https://scontent.cdninstagram.com/vp/63cc7da0b2892ff1e118119cc4e0a979/5B5BA9CC/t51.2885-15/s640x640/sh0.08/e35/13437357_1071137216269475_2058872741_n.jpg',
  link: TECHX_CARD_DETAIL_ROUTE
};
const TYPOGRAPHICS_CARD_INFO = {
  name: 'Typographics studio',
  category: 'aspirational',
  filter: 'Normal Filter',
  description: 'typographics',
  likes: '3',
  comments: '12',
  available: 'Register first!',
  concept: 'A creative studio illustrating meaningful messages, crafting passionate brand stories, and designing colorful pattern collections.',
  src: 'https://scontent.cdninstagram.com/vp/c13fe717b462b562a6717dccd082c362/5B538F8A/t51.2885-15/s640x640/sh0.08/e35/1515286_1555777788086105_1349596983_n.jpg',
  link: TYPOGRAPHICS_CARD_DETAIL_ROUTE
};
const DESIGN_STUDIO_CARD_INFO = {
  name: 'Design studio',
  category: 'aspirational',
  filter: 'Normal Filter',
  description: 'typographics',
  likes: '42',
  comments: '112',
  available: 'In 2 days!',
  concept: 'DesignStudio is a web-based assay design tool to help researchers design and order custom sequencing probes, or create custom genotyping assays.',
  src: 'https://scontent.cdninstagram.com/vp/e8b418d7582a842b8f82101b307b5f5a/5B71CA24/t51.2885-15/s640x640/sh0.08/e35/13385851_954384044675150_1252219938_n.jpg',
  link: ''
};

const cards = [
  [BLACBIRD_CARD_INFO, TECHX_CARD_INFO],
  [TYPOGRAPHICS_CARD_INFO, DESIGN_STUDIO_CARD_INFO]
];

/**
 * @modifies {localforage}
 * @param localforage
 */
export function loadTestData(localforage) {
  return Promise.all(cards.map((domainObjectTestData, index) => {
    return localforage.setItem(index + "", domainObjectTestData);
  }))
    .then(() => {
      localforage.setItem(PAGE_REF, PAGE_INIT)
    })
}

