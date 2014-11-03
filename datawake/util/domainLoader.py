"""

Copyright 2014 Sotera Defense Solutions, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

"""

import sys
import argparse
import os.path
from datawake.util import datawake_db as db
import datawake.util.entity_data_connector_factory as factory



def loadDomain(name,description,filename):
    print '\nloading domain: ',name,'\ndescription: ',description,'\nfrom path: ',filename,'\n'

    #if db.domain_exists(name):
    #    raise ValueError("Domain already exists: "+name)

    fobj = open(filename,'r')

    domain_content_connector = factory.getEntityDataConnector()
    try:
        cnt = 0
        items = []
        for row in fobj:
            row = row.strip()
            row = row.replace("\"",'')
            cnt = cnt + 1
            if ',' not in row:
                continue
            i = row.index(',')
            attr = row[:i]
            value = row[i+1:]
            items.append(name+'\0'+attr+'\0'+value)
            if cnt % 1000 == 0:
                domain_content_connector.add_new_domain_items(items)
                items = []
            if cnt % 1000 == 0:
                print 'added: ',cnt
        if len(items) > 0:
            domain_content_connector.add_new_domain_items(items)

        print 'added new items cnt=',cnt

        db.add_new_domain(name,description)
    finally:
        fobj.close()
        domain_content_connector.close()




if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Add or remove email org links')
    parser.add_argument('domainName',help='name of the domain being loaded')
    parser.add_argument('domainDescription',help='description of the domain')
    parser.add_argument('domainFile',help='csv file of email address, org name')
    args = parser.parse_args()
    loadDomain(args.domainName,args.domainDescription,args.domainFile)