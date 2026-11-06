"""Systems16 replay and protocol arithmetic; no network or firewall invocation.

TFTP uses the signed bounded model, not a universal implementation limit.
Satellite, standards catalog and cable properties retain documentary scope.
"""
from decimal import Decimal
import ipaddress
import json
import unittest
from historical_bank import EDITORIAL
import test_m7_replay

LEDGER=json.loads((EDITORIAL/'reviewed-systems16.json').read_text())
ROWS={q['id']:q['after'] for q in LEDGER['questions']}

class Systems16Tests(unittest.TestCase):
    def test_exact_replay_and_boundary(self):
        test_m7_replay.M7ReplayTests.check_batch(self,'reviewed-systems16',16,6,0)

    def test_spf_network_and_link_local_selection_bounds(self):
        network=ipaddress.IPv4Network('192.168.16.0/21')
        row=ROWS['AT403-P1-39']
        results=[ipaddress.IPv4Address(value.strip().rstrip('.')) not in network for value in row['a']]
        self.assertEqual([i for i,v in enumerate(results) if v],[row['c']])
        row=ROWS['AT407-P1-57'];low=ipaddress.IPv4Address('169.254.1.0');high=ipaddress.IPv4Address('169.254.254.255')
        results=[low<=ipaddress.IPv4Address(value.strip().rstrip('.'))<=high for value in row['a']]
        self.assertEqual([i for i,v in enumerate(results) if v],[row['c']])
        self.assertFalse(low<=ipaddress.IPv4Address('169.254.0.255')<=high)
        self.assertFalse(low<=ipaddress.IPv4Address('169.254.255.0')<=high)

    def test_tftp_last_short_block_and_gprs_exact_decimal(self):
        row=ROWS['AT408-P1-40']
        maximum=65534*512+511
        self.assertEqual(maximum,33553919)
        self.assertEqual(row['a'][row['c']],f'{maximum} octetos.')
        # One further byte fills block65535 and would require block65536 to
        # send the terminating zero-byte DATA, excluded by the stated model.
        self.assertEqual((maximum+1)//512,65535)
        self.assertEqual((maximum+1)%512,0)
        self.assertIn('sin rollover',row['q'])
        gprs=ROWS['GEN-T4.06-57.v1'];rate=Decimal('21.4')*8
        self.assertEqual(rate,Decimal('171.2'))
        self.assertEqual(gprs['a'][gprs['c']],str(rate).replace('.',',')+' kbit/s')

    def test_signed_flags_unchanged(self):
        for q in LEDGER['questions']:
            self.assertEqual(q['after'].get('np'),q['before'].get('np'))
            self.assertEqual(q['after'].get('w'),q['before'].get('w'))
            self.assertTrue(q['primary'])
