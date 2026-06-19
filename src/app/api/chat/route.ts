import { NextRequest, NextResponse } from 'next/server';
import { executeConfirmedAgentAction, runAgentConversation } from '@/lib/agent';
import type { AgentMode } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, query, conversationHistory = [], mode = 'assistant', confirmedAction } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const normalizedMode: AgentMode = mode === 'agent' ? 'agent' : 'assistant';

    if (confirmedAction) {
      const { response, activities, sources, model, actionResult } = await executeConfirmedAgentAction(
        userId,
        confirmedAction
      );
      return NextResponse.json({ response, activities, sources, model, actionResult });
    }

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const { response, activities, sources, model, pendingAction, actionResult } = await runAgentConversation(
      userId,
      query,
      conversationHistory,
      normalizedMode
    );

    return NextResponse.json({ response, activities, sources, model, pendingAction, actionResult });
  } catch (error) {
    console.error('Agent chat error:', error);
    const message = error instanceof Error ? error.message : 'Chat agent failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
