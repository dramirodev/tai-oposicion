import { StudyMarkup } from './StudyMarkup.js';

interface StudyQuestionSourcesProps {
  noticeHtml?: string;
  sourceHtml?: string;
  languageContext?: string;
}

/** Renders question notices and source references using the shared study markup renderer. */
export function StudyQuestionSources({ noticeHtml, sourceHtml, languageContext }: StudyQuestionSourcesProps) {
  return <>{noticeHtml && <StudyMarkup html={noticeHtml} languageContext={languageContext} />}{sourceHtml && <StudyMarkup html={sourceHtml} languageContext={languageContext} />}</>;
}
