"""Offline regression for the scoped Explorer adapter; run with its venv Python."""
import os
import unittest
from unittest.mock import patch
from langchain_core.messages import AIMessage, HumanMessage
from agentic_explorer.orchestration.graph_base import make_agent_node


class AgentHistoryRegression(unittest.IsolatedAsyncioTestCase):
    async def test_old_messages_and_candidates_are_not_reemitted(self):
        previous = [HumanMessage(content='Synthetic mission'), AIMessage(content='<bugs_found>[{"title":"Old candidate"}]</bugs_found>')]

        class Agent:
            async def astream(self, state, config=None):
                yield {"messages":[*state['messages'], AIMessage(content='Fresh observation <bugs_found>[]</bugs_found>')]}

        with patch.dict(os.environ, {'TAI_AGENT_EMULATOR_ONLY':'1'}):
            result = await make_agent_node(Agent(), name='test_agent', quiet=True)({'messages':previous})
        self.assertEqual(len(result['messages']), 1)
        self.assertIn('Fresh observation', result['messages'][0].content)
        self.assertEqual(result['bugs_found'], [])


if __name__ == '__main__':
    unittest.main()
