import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LogIn, RotateCcw, UserRound } from 'lucide-react';

interface SettingsViewProps {
  language: string;
  context: string;
  focusKeyword: string;
  brand: string;
  signedIn: boolean;
  email?: string;
  accountStatus: string;
  onLanguageChange: (value: string) => Promise<void> | void;
  onContextChange: (value: string) => Promise<void> | void;
  onFocusKeywordChange: (value: string) => Promise<void> | void;
  onBrandChange: (value: string) => Promise<void> | void;
  onReset: () => Promise<void> | void;
  onSignIn: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
}

const LANGUAGE_OPTIONS = [
  ['auto', 'Auto'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'],
  ['zh', 'Chinese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['hi', 'Hindi'],
] as const;

export function SettingsView({
  language,
  context,
  focusKeyword,
  brand,
  signedIn,
  email,
  accountStatus,
  onLanguageChange,
  onContextChange,
  onFocusKeywordChange,
  onBrandChange,
  onReset,
  onSignIn,
  onSignOut,
}: SettingsViewProps) {
  return (
    <section className="command-page-view" aria-labelledby="settings-heading">
      <div className="command-view-heading">
        <div>
          <span className="command-eyebrow">Extension settings</span>
          <h2 id="settings-heading">Generation defaults</h2>
          <p>These values are stored locally and applied when you open a new workspace.</p>
        </div>
        <span className="command-settings-saved">Saved automatically</span>
      </div>

      <div className="command-settings-section">
        <div className="command-settings-section__label">
          <h3>Output guidance</h3>
          <p>Keep context, search focus, and brand signals separate so each can be changed without rewriting the others.</p>
        </div>
        <div className="command-settings-fields">
          <div className="command-field">
            <Label htmlFor="settings-language" className="command-label">Language</Label>
            <Select value={language || 'auto'} onValueChange={(value) => onLanguageChange(value === 'auto' ? '' : value)}>
              <SelectTrigger id="settings-language" aria-label="Default language">
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="command-field command-settings-fields__wide">
            <Label htmlFor="settings-context" className="command-label">Page or product context</Label>
            <Textarea
              id="settings-context"
              className="command-textarea"
              value={context}
              onChange={(event) => onContextChange(event.target.value)}
              placeholder="What is this page, product, or article about?"
            />
          </div>
          <div className="command-field">
            <Label htmlFor="settings-keyword" className="command-label">Focus keyword <span className="command-optional">Optional</span></Label>
            <input
              id="settings-keyword"
              className="command-input"
              value={focusKeyword}
              onChange={(event) => onFocusKeywordChange(event.target.value)}
              placeholder="e.g. oak dining chair"
              maxLength={80}
            />
          </div>
          <div className="command-field">
            <Label htmlFor="settings-brand" className="command-label">Brand <span className="command-optional">Optional</span></Label>
            <input
              id="settings-brand"
              className="command-input"
              value={brand}
              onChange={(event) => onBrandChange(event.target.value)}
              placeholder="e.g. North & Pine"
              maxLength={80}
            />
          </div>
        </div>
        <div className="command-settings-actions">
          <Button className="command-secondary" onClick={onReset}><RotateCcw size={15} />Reset defaults</Button>
        </div>
      </div>

      <div className="command-settings-section">
        <div className="command-settings-section__label">
          <h3>Account</h3>
          <p>Your account connects access, billing, allowance, and local history.</p>
        </div>
        <div className="command-settings-account">
          <span className="command-settings-account__icon"><UserRound size={19} /></span>
          <div>
            <strong>{signedIn ? email : 'Not signed in'}</strong>
            <span>{accountStatus}</span>
          </div>
          {signedIn ? (
            <Button className="command-danger-button" variant="ghost" onClick={onSignOut}>Sign out</Button>
          ) : (
            <Button className="command-secondary" onClick={onSignIn}><LogIn size={15} />Sign in</Button>
          )}
        </div>
      </div>
    </section>
  );
}
