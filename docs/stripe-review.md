# Stripe's review of the site

Stripe reviews a business's website before it activates live payments, and keeps checking it
afterwards. A deployment's content can meet that review the first time: this is what Stripe asks
for, and how the demo meets it.

Read on 2026-11-26 from Stripe's
[website checklist](https://docs.stripe.com/get-started/checklist/website), its
[business website for account activation FAQ](https://support.stripe.com/questions/business-website-for-account-activation-faq)
and its [restricted businesses](https://stripe.com/legal/restricted-businesses) list (last updated
2026-09-22). The first two show no date. Stripe changes them: read them again before applying.

## What Stripe asks for

"Required" is what the FAQ lists as what the website must include, or what the checklist words as a
must; "asked" is what the checklist tells a business to do and Stripe may ask to be added;
"recommended" is what the checklist only recommends. Whether a review accepts a page is Stripe's:
none of this has been through a review yet.

<!-- prettier-ignore -->
| Point | Stripe's words | Weight | The demo | A deployment checks |
|---|---|---|---|---|
| Business name | "Your business name" | Required | The header, the footer and the imprint | The name matches the one given to Stripe |
| What is sold | "Descriptions of the goods or services offered", which "must align with the information you've provided to Stripe" | Required | The apartments' pages: rooms, amenities, pictures, the week's price | The business description given to Stripe says holiday apartments let by the week |
| The currency | "Listing only the currency symbol might not be enough" | Asked | Prices show the euro sign; the rental terms say they are in euros, VAT included | Its terms name the currency |
| Contact | "multiple contact methods", "something besides contact forms" | Required | Phone, email and address in the footer and on the imprint | Each one reaches someone |
| The website is the business's | Stripe "might require you to confirm you own the website", by an email at its domain or one shown on the site | Required when asked | An email address at the demo's domain, in the footer | An address at its own domain, shown on the site |
| Refund policy | "the conditions under which customers can receive a refund" | Required | The rental terms' cancellation section says what is charged, and that a cancellation by the landlord refunds everything; how money goes back waits for payments (#353) | Its terms say how and when a refund is paid |
| Cancellation policy | "the conditions under which customers can cancel subscriptions or reservations" | Required | The rental terms, section 5 | Its terms |
| Privacy policy | "Clearly explaining your website's privacy policy" | Asked | The privacy page; Stripe as a recipient waits for payments (#353) | Its privacy page names Stripe |
| Business address | "If you have a physical address, listing it on your website adds credibility" | Recommended | The footer and the imprint | Its address |
| Payment security | The site, "especially your payment form", uses HTTPS; "explain that your customer's payment information is handled safely" | Required | HTTPS with HSTS, plain HTTP redirected; card details on Stripe's page and never on the server is said with payments (#353) | Its privacy page or terms say where the card is entered |
| Open to anyone | "The webpage must be accessible without a password" | Required | No password | `SITE_PASSWORD` is unset ([deploying a site](deploying-a-site.md)) |
| Finished | An account "may not be able to be activated until your website contains the necessary information" | Required | Not applying | Everything above is on the site before it applies (below) |
| Shipping, returns | Shipping and return policies, for goods | Not applicable | No goods are sent or returned | — |
| Promotions | "the conditions of any promotion, discount, or trial" | Not applicable | No promotions | Any offer it runs states its terms |
| Legal or export restrictions | "Properly disclosing any applicable restrictions" | Not applicable | The rental terms say who may book and how many may stay | — |
| Card logos | "displaying the brand logos of the credit cards that you accept" | Recommended | Not shown: Stripe Checkout shows the cards it accepts | — |
| The card statement | Text telling customers what their statement will show | Recommended | Not shown | The statement descriptor is set in Stripe |
| The business is allowed | Stripe's restricted and prohibited businesses | Required | Holiday letting is not on the list | — |

## When to apply

A deployment goes public before its booking does, since live payments wait for the approval
([ADR 18](adr/0018-booking-through-the-api-and-stripe-checkout.md)). Its site then shows the
apartments, prices, terms, privacy page and contact, and the booking step says that online booking
is not open yet. Whether Stripe treats such a site as finished is not checked.
