# Stripe's review of the site

Stripe reviews a business's website before it activates live payments, and keeps checking it
afterwards. A deployment's content can meet that review the first time: this is what Stripe asks
for, and how the demo meets it.

Read on 2026-11-26 from Stripe's
[website checklist](https://docs.stripe.com/get-started/checklist/website), its
[business website for account activation FAQ](https://support.stripe.com/questions/business-website-for-account-activation-faq),
its [account checklist](https://docs.stripe.com/get-started/account/checklist), its page on
[card testing](https://docs.stripe.com/disputes/prevention/card-testing) and its
[restricted businesses](https://stripe.com/legal/restricted-businesses) list (last updated
2026-09-22). The others show no date. Stripe changes them: read them again before applying.

## What Stripe asks for, and by when

The FAQ sets two deadlines. **For activation,** the site shows the business's name and a description
of what it sells that matches what Stripe was told. **By the time it starts selling,** it also shows
customer service contact details, its refund and dispute policy, its cancellation policy, any legal
or export restrictions and the terms of any promotion; the FAQ asks for these as soon as possible
and may want them sooner for businesses it rates as higher risk. Throughout, the site is reachable
without a password and kept working with this information on it, and without a regional block until
Stripe has verified it.

This project's choice: a deployment applies with everything that does not depend on payments already
on its site, and adds the rest, such as where the card is entered, before its booking opens (below).

"Activation" and "Selling" below are the FAQ's two deadlines; "Asked" is what the website checklist
tells a business to do and Stripe may ask to be added; "Recommended" is what a checklist only
recommends. Whether a review accepts a page is Stripe's: none of this has been through a review yet.

<!-- prettier-ignore -->
| Point | Stripe's words | Weight | The demo | A deployment checks |
|---|---|---|---|---|
| Business name | "Your business name" | Activation | The header, the footer and the imprint | The name matches the one given to Stripe |
| What is sold | "Descriptions of the goods or services offered", which "must align with the information you've provided to Stripe" | Activation | The apartments' pages: rooms, amenities, pictures, the week's price | The business description given to Stripe says holiday apartments let by the week |
| Contact details | "phone, email, address, contact form, or an online messaging service contact" | Selling | An email address in the footer and on the imprint, which reaches the person who runs the demo; the phone number and the postal address are made up | At least one channel, each one listed reaching someone |
| Several ways to reach the business | "multiple contact methods", "something besides contact forms" | Asked | Only the email address works | Email and phone, or another direct channel |
| The website is the business's | Stripe "might require you to confirm you own the website", by an email at its domain or one shown on the site | When asked | An email address at the demo's domain, in the footer | An address at its own domain, shown on the site |
| Refund and dispute policy | "Refund and dispute policy"; "the conditions under which customers can receive a refund" | Selling | The rental terms' cancellation section says what is charged, and that a cancellation by the landlord refunds everything; the imprint says to write to the landlord and that it takes no part in arbitration. How and when money goes back, and how to raise a complaint, wait for payments (#353) | Its terms say how and when a refund is paid and how a guest complains, with any mediator the law requires |
| Cancellation policy | "Cancellation policy (if applicable)" | Selling | The rental terms, section 5 | Its terms |
| Legal or export restrictions | "Properly disclosing any applicable restrictions" | Selling, if any | The rental terms say who may book and how many may stay | Any restriction its trade has |
| Promotions | "the conditions of any promotion, discount, or trial" | Selling, if any | No promotions | Any offer it runs states its terms |
| The currency | "Listing only the currency symbol might not be enough" | Asked | Prices show the euro sign; the rental terms say they are in euros, VAT included | Its terms name the currency |
| Privacy policy | "Clearly explaining your website's privacy policy" | Asked | The privacy page; Stripe as a recipient waits for payments (#353) | Its privacy page names Stripe |
| Business address | "If you have a physical address, listing it on your website adds credibility" | Asked | A made-up address in the footer and on the imprint | Its real address |
| HTTPS | The site, "especially your payment form", uses HTTPS | Asked | HTTPS with HSTS, plain HTTP redirected (checked 2026-11-26) | Comes with the deployment ([ADR 7](adr/0007-hosting-and-delivery.md)) |
| Card data handled safely | "explain that your customer's payment information is handled safely"; "know that you comply with the PCI standards" | Asked | Waits for payments: card details are entered on Stripe's page and never reach the server, said in #353 | Its privacy page says where the card is entered, in #353's wording; its PCI validation form, which Stripe helps to complete in its dashboard for Checkout ([security](https://docs.stripe.com/security)), is done |
| Card testing | The payment form "isn't susceptible to card testing" | Asked | Waits for payments. Stripe says Checkout, where the card is entered, has "rate limiters, AI models, CAPTCHA triggers"; #349 checks that the card is entered only there | Stripe's dashboard after the first payments |
| No password | "The webpage must be accessible without a password" | Throughout | No password (checked 2026-11-26) | `SITE_PASSWORD` is unset ([deploying a site](deploying-a-site.md)) |
| No regional block | "Temporarily remove the blocker until your website has been verified" | Until verified | The server blocks no region, reached from one network only | No firewall or DNS service blocks a region |
| Kept up | "maintain a functioning website with the appropriate information at all times" | Throughout | Deployed from `main` | Its content stays in step with its terms |
| The business is allowed | Stripe's restricted and prohibited businesses | Throughout | Holiday letting is not on the list | — |
| Shipping, returns | Shipping and return policies, "if physical goods are sold" | Not applicable | No goods are sent or returned | — |
| Card logos | "displaying the brand logos of the credit cards that you accept" | Recommended | Not shown: Stripe Checkout shows the cards it accepts | — |
| The card statement | "add text to your site that tells your users what they'll see on their statements" (account checklist) | Recommended | Not shown | The statement descriptor set in Stripe, and a line in its FAQ or terms |

## When to apply

A deployment goes public before its booking does, since live payments wait for the approval
([ADR 18](adr/0018-booking-through-the-api-and-stripe-checkout.md)). Its site then shows the
apartments, prices, terms, privacy page and contact, and the booking step says that online booking
is not open yet. That meets the FAQ's activation deadline; the points marked "waits for payments"
are on the site before its booking opens. Whether a review takes such a site as finished is not
checked.
