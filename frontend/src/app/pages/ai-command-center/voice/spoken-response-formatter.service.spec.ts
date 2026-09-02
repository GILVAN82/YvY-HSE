import { SpokenResponseFormatterService } from './spoken-response-formatter.service';

describe('SpokenResponseFormatterService',()=>{
  const service=new SpokenResponseFormatterService();
  it('keeps the detailed display response while shortening a long spoken response',()=>{const display='I found three overdue actions. Gas detector calibration is eight days overdue. '.repeat(5);const result=service.format(display,'en');expect(result.displayResponse).toBe(display);expect(result.spokenResponse.length).toBeLessThan(display.length);expect(result.spokenResponse).toContain('three overdue actions');});
  it('does not invent priority, counts or operational facts',()=>{const result=service.format('Two inspections remain open. '.repeat(15),'en');expect(result.spokenResponse).not.toMatch(/high priority|three|approved/i);expect(result.spokenResponse).toContain('Two inspections');});
  it('removes citation metadata from speech without changing the written answer',()=>{const display='Isolation is required.\nSource: OSHA 1910.147\nVerification: VERIFIED';const result=service.format(display,'en');expect(result.displayResponse).toBe(display);expect(result.spokenResponse).not.toContain('OSHA 1910.147');});
});
