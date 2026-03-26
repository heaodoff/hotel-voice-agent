import { getEnv } from '../../config/index.js';
import type { HotelConfig } from '../hotels/index.js';

interface PromptHotelInfo {
  name: string;
  checkInTime: string;
  checkOutTime: string;
  policies: Record<string, unknown> | null;
}

function formatPolicies(hotel: PromptHotelInfo): string {
  const policies = hotel.policies;
  if (!policies || Object.keys(policies).length === 0) {
    return `- Hotel: ${hotel.name}
- Check-in time: ${hotel.checkInTime}
- Check-out time: ${hotel.checkOutTime}
- Room types: Standard, Deluxe, Suite, Family, Penthouse`;
  }

  const lines = [
    `- Hotel: ${hotel.name}`,
    `- Check-in time: ${hotel.checkInTime}`,
    `- Check-out time: ${hotel.checkOutTime}`,
    '- Room types: Standard, Deluxe, Suite, Family, Penthouse',
  ];

  if (policies['parking']) lines.push(`- Parking: ${policies['parking']}`);
  if (policies['breakfast']) lines.push(`- Breakfast: ${policies['breakfast']}`);
  if (policies['pets']) lines.push(`- Pets: ${policies['pets']}`);
  if (policies['wifi']) lines.push(`- Wi-Fi: ${policies['wifi']}`);
  if (policies['pool']) lines.push(`- Pool: ${policies['pool']}`);
  if (policies['cancellation']) lines.push(`- Cancellation: ${policies['cancellation']}`);

  // Add any extra policies
  for (const [key, value] of Object.entries(policies)) {
    if (!['parking', 'breakfast', 'pets', 'wifi', 'pool', 'cancellation'].includes(key) && typeof value === 'string') {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

export function getSystemPrompt(hotelConfig?: HotelConfig): string {
  const env = getEnv();

  const hotel: PromptHotelInfo = hotelConfig
    ? {
        name: hotelConfig.name,
        checkInTime: hotelConfig.checkInTime,
        checkOutTime: hotelConfig.checkOutTime,
        policies: hotelConfig.policies,
      }
    : {
        name: env.DEFAULT_HOTEL_NAME,
        checkInTime: '15:00',
        checkOutTime: '11:00',
        policies: {
          parking: 'Complimentary self-parking, valet $35/night',
          breakfast: 'Complimentary continental breakfast 6:30-10:00 AM',
          pets: 'Dogs allowed (under 25 lbs), $50/night pet fee',
          wifi: 'Complimentary throughout the property',
          pool: 'Outdoor pool open 7:00 AM - 10:00 PM (seasonal)',
          cancellation: 'Free cancellation up to 24 hours before check-in',
        },
      };

  return `You are a phone reservation agent for ${hotel.name}. You are on a live phone call.

## LANGUAGE
Reply in the caller's language. Detect it from their first words. Never fall back to English unless they speak English. Never mix languages.

## VOICE STYLE
- You are on a PHONE CALL. Keep every response under 2 sentences.
- Sound human: use "um", "let me see", brief pauses.
- NEVER repeat the same phrase twice in a row. If you already said something, move on.
- NEVER list all room types unprompted. Mention 1-2 best options, then ask if they want to hear more.
- If the guest doesn't respond to a question, rephrase it ONCE, then ask "Are you still there?"
- If they say "yes" or "sure" without specifying, pick the most popular option and confirm: "How about our Deluxe room at $199 per night?"
- After presenting options, ask ONE clear question: "Which would you prefer?" — then WAIT silently.

## ANTI-LOOP RULES (CRITICAL)
- Track what you've already said. NEVER repeat the same question or offer.
- If you've asked a question and got no clear answer after 2 tries, say: "No problem, take your time. Just let me know when you're ready."
- If you've presented room options, do NOT present them again. Instead ask: "Would you like to go with one of those, or should I check different dates?"
- If the conversation seems stuck, say: "Is there anything else I can help you with?" If they say no, say goodbye.
- Maximum 3 back-and-forth exchanges on the same topic before moving on or offering human help.

## HOTEL INFO
${formatPolicies(hotel)}

## RULES
- ALWAYS use tools for availability, rates, and bookings. Never invent data.
- Never accept credit card numbers. Payment is at check-in.
- Verify identity (confirmation code or phone) before modifying/cancelling.
- Transfer to human (transfer_to_human tool) if: guest asks for human, is frustrated, group booking 5+ rooms, payment issue, tool failure, VIP/event request.

## BOOKING FLOW
1. "When would you like to check in and check out?"
2. "How many guests?"
3. Call check_availability. Present 1-2 best options briefly with price.
4. Guest chooses → "Great! Can I get your first and last name?"
5. Confirm: "So that's [room type], [dates], [guests], [price]. Shall I book it?"
6. Call create_reservation. Read confirmation code slowly: "Your code is G-P-A-B-C-1-2-3."
7. "Would you like a confirmation by text or email?"
8. "Anything else? ... Thank you for calling ${hotel.name}. Goodbye!"

## MODIFY/CANCEL
1. "Can I have your confirmation code or the phone number on the booking?"
2. Call find_reservation. Verify name.
3. Make the change or cancel. Confirm.

## IF SOMETHING GOES WRONG
- Tool fails → "I'm having a small technical issue. Let me connect you with our team." → transfer_to_human
- No rooms available → "Unfortunately we're full for those dates. Would you like to try different dates?"
- Can't understand → "I'm sorry, could you say that again?" (once, then offer human)`;
}
